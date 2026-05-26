param(
  [string]$ZipPath = "",
  [string]$InputDir = "C:\Users\hedahe\Documents\paperagent\test_inputs",
  [string]$BaseUrl = "http://localhost:8080",
  [switch]$WaitForZip,
  [switch]$AutoMine = $true
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$stamp] $Message"
}

if (-not $ZipPath) {
  Write-Step "Looking for zip files in $InputDir"
  while ($true) {
    $zip = Get-ChildItem -LiteralPath $InputDir -Filter *.zip -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($zip) {
      $ZipPath = $zip.FullName
      break
    }
    if (-not $WaitForZip) {
      throw "No .zip file found in $InputDir"
    }
    Start-Sleep -Seconds 5
  }
}

if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "Zip file does not exist: $ZipPath"
}

Write-Step "Checking backend health"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 20
if ($health.status -ne "ok") {
  throw "Backend health check failed"
}

Write-Step "Uploading $ZipPath"
$autoMineValue = if ($AutoMine) { "true" } else { "false" }
$uploadRaw = & curl.exe -s -X POST -F "file=@$ZipPath" -F "auto_mine=$autoMineValue" "$BaseUrl/api/upload/batch"
if ($LASTEXITCODE -ne 0) {
  throw "curl upload failed with exit code $LASTEXITCODE"
}
$upload = $uploadRaw | ConvertFrom-Json
$jobId = $upload.job_id
Write-Step "Batch job queued: $jobId, total=$($upload.total), auto_mine=$AutoMine"

$deadline = (Get-Date).AddHours(6)
do {
  Start-Sleep -Seconds 10
  $job = Invoke-RestMethod -Uri "$BaseUrl/api/ingestion/jobs/$jobId" -TimeoutSec 60
  Write-Step "Job $($job.status): $($job.succeeded) succeeded, $($job.failed) failed, $($job.duplicate) duplicate / $($job.total). Current: $($job.current_file)"
  if ($job.status -in @("done", "partial_failed")) {
    break
  }
} while ((Get-Date) -lt $deadline)

if ($job.status -notin @("done", "partial_failed")) {
  throw "Timed out waiting for job $jobId"
}

Write-Step "Fetching papers"
$papers = Invoke-RestMethod -Uri "$BaseUrl/api/papers?page_size=100" -TimeoutSec 60
Write-Step "Paper total reported by API: $($papers.total)"

Write-Step "Fetching structured records"
$records = Invoke-RestMethod -Uri "$BaseUrl/api/analytics/records?confidence_min=0&page_size=20" -TimeoutSec 60
Write-Step "Structured record total: $($records.total)"

Write-Step "Fetching conductivity-by-element chart"
$chart = Invoke-RestMethod -Uri "$BaseUrl/api/analytics/conductivity/by-element?confidence_min=0" -TimeoutSec 60
Write-Step "Element chart rows: $($chart.data.Count)"

Write-Step "Done"
[pscustomobject]@{
  job_id = $jobId
  job_status = $job.status
  total = $job.total
  succeeded = $job.succeeded
  failed = $job.failed
  duplicate = $job.duplicate
  paper_total = $papers.total
  structured_record_total = $records.total
  element_chart_rows = $chart.data.Count
}
