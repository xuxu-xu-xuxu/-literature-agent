const BASE = "/api";

export async function fetchPapers(params?: {
  page?: number;
  keyword?: string;
  year_from?: number;
  year_to?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/papers?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch papers");
  return resp.json();
}

export async function uploadPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(`${BASE}/upload`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

export async function uploadBatchZip(file: File, autoMine = false) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("auto_mine", String(autoMine));
  const resp = await fetch(`${BASE}/upload/batch`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error("Batch upload failed");
  return resp.json();
}

export async function fetchIngestionJobs() {
  const resp = await fetch(`${BASE}/ingestion/jobs`);
  if (!resp.ok) throw new Error("Failed to fetch ingestion jobs");
  return resp.json();
}

export async function triggerSolidElectrolyteExtraction(paperId: string) {
  const resp = await fetch(`${BASE}/extract/solid-electrolyte/${paperId}`, { method: "POST" });
  if (!resp.ok) throw new Error("Solid electrolyte extraction failed");
  return resp.json();
}

export async function triggerExtraction(paperId: string) {
  const resp = await fetch(`${BASE}/extract/${paperId}`, { method: "POST" });
  if (!resp.ok) throw new Error("Extraction failed");
  return resp.json();
}

export async function fetchEntities(params?: {
  entity_type?: string;
  paper_id?: string;
  page?: number;
  page_size?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/entities?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch entities");
  return resp.json();
}

export async function deletePaper(paperId: string) {
  const resp = await fetch(`${BASE}/papers/${paperId}`, { method: "DELETE" });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body.detail || "";
    } catch {}
    throw new Error(detail || `删除失败 (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function runSchemaConvergence() {
  const resp = await fetch(`${BASE}/entities/converge`, { method: "POST" });
  if (!resp.ok) throw new Error("Convergence failed");
  return resp.json();
}

export async function visualizeQuery(query: string) {
  const resp = await fetch(`${BASE}/visualize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error("Visualization failed");
  return resp.json();
}

export async function fetchSolidElectrolyteRecords(params?: {
  paper_id?: string;
  method?: string;
  element?: string;
  confidence_min?: number;
  page?: number;
  page_size?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/records?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch solid electrolyte records");
  return resp.json();
}

export async function fetchConductivityByElement(params?: {
  metric?: "avg" | "median";
  method?: string;
  temperature_min?: number;
  temperature_max?: number;
  confidence_min?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/analytics/conductivity/by-element?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by element");
  return resp.json();
}

export async function fetchConductivityByMethod() {
  const resp = await fetch(`${BASE}/analytics/conductivity/by-method`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by method");
  return resp.json();
}

export async function fetchConductivityByTemperature() {
  const resp = await fetch(`${BASE}/analytics/conductivity/by-temperature`);
  if (!resp.ok) throw new Error("Failed to fetch conductivity by temperature");
  return resp.json();
}
