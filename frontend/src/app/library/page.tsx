"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Upload, Archive, Trash2, Pause, X, Loader2, FileArchive } from "lucide-react";
import {
  fetchPapers,
  uploadPDF,
  uploadBatchZip,
  deletePaper,
  fetchIngestionJobs,
  pauseIngestionJob,
  cancelIngestionJob,
} from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  status: string;
}

interface IngestionJob {
  id: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  duplicate: number;
  current_file: string | null;
}

export default function LibraryPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [keyword, setKeyword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "info" } | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers({ keyword: keyword || undefined });
      setPapers(data.items || []);
    } catch {
      setMessage({ text: "加载文献列表失败", type: "error" });
    }
  }, [keyword]);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchIngestionJobs();
      setJobs(data.items || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadPapers();
    loadJobs();
  }, [loadPapers, loadJobs]);

  // Auto-poll when there are active jobs or processing papers
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasProcessing = papers.some((p) => p.status === "processing");
    const hasActiveJob = jobs.some((j) =>
      j.status === "extracting" || j.status === "queued" || j.status === "running"
    );
    if ((hasProcessing || hasActiveJob) && !pollRef.current) {
      pollRef.current = setInterval(() => { loadPapers(); loadJobs(); }, 3000);
    } else if (!hasProcessing && !hasActiveJob && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [papers, jobs, loadPapers, loadJobs]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const result = await uploadPDF(file);
      if (result.status === "duplicate") {
        setMessage({ text: "该文献已存在，已跳过", type: "info" });
      } else {
        await loadPapers();
      }
    } catch {
      setMessage({ text: "上传失败", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleBatchUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      await uploadBatchZip(file, false);
      await loadPapers();
      await loadJobs();
    } catch {
      setMessage({ text: "批量导入失败", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePaper(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : "删除失败", type: "error" });
    }
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      await pauseIngestionJob(jobId);
      await loadJobs();
    } catch {}
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelIngestionJob(jobId);
      await loadJobs();
    } catch {}
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "extracting": return "解压中";
      case "queued": return "排队中";
      case "running": return "处理中";
      case "paused": return "已暂停";
      case "cancelled": return "已取消";
      case "done": return "已完成";
      case "failed": return "失败";
      case "partial_failed": return "部分失败";
      default: return s;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading text-[#1a2744]">文献库</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {papers.length} 篇文献
            </p>
          </div>
          <div className="flex gap-3">
            <input ref={zipRef} type="file" accept=".zip" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBatchUpload(f); e.target.value = ""; }} />
            <button onClick={() => zipRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a2744] text-[#1a2744] rounded-lg text-sm font-medium hover:bg-[#eef2f8] disabled:opacity-50">
              <Archive className="w-4 h-4" />批量导入
            </button>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            <button onClick={() => pdfRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#1a2744" }}>
              <Upload className="w-4 h-4" />{uploading ? "上传中..." : "上传 PDF"}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 px-4 py-2 border rounded-lg text-sm ${
            message.type === "error" ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-200 text-blue-600"
          }`}>{message.text}</div>
        )}

        {/* Active Batch Jobs */}
        {jobs.filter((j) => j.status !== "done" && j.status !== "cancelled").length > 0 && (
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-heading font-semibold text-[#1a2744]">批量导入任务</h2>
            {jobs.filter((j) => j.status !== "done" && j.status !== "cancelled").slice(0, 5).map((job) => (
              <div key={job.id} className="border border-[#e5e7eb] rounded-lg bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {job.status === "extracting" && <FileArchive className="w-4 h-4 text-[#1a2744]" />}
                    {job.status === "running" && <Loader2 className="w-4 h-4 animate-spin text-[#1a2744]" />}
                    {job.status === "paused" && <Pause className="w-4 h-4 text-amber-500" />}
                    <span className="text-sm font-medium text-gray-700">{statusLabel(job.status)}</span>
                    <span className="text-xs text-gray-500">
                      {job.succeeded + job.failed + job.duplicate}/{job.total || "?"} 篇
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(job.status === "running" || job.status === "queued" || job.status === "extracting") && (
                      <button onClick={() => handlePauseJob(job.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-amber-50 text-amber-600 hover:bg-amber-100">
                        <Pause className="w-3 h-3" />暂停
                      </button>
                    )}
                    <button onClick={() => handleCancelJob(job.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100">
                      <X className="w-3 h-3" />删除
                    </button>
                  </div>
                </div>
                {job.total > 0 && (
                  <div className="bg-[#e5e7eb] rounded-full h-2 overflow-hidden">
                    <div className="bg-[#1a2744] h-full rounded-full transition-all duration-500"
                      style={{ width: `${((job.succeeded + job.failed + job.duplicate) / job.total) * 100}%` }} />
                  </div>
                )}
                {job.current_file && (
                  <div className="text-xs text-gray-500 mt-2 truncate">当前: {job.current_file}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索标题..."
            className="w-full pl-9 pr-4 py-2 border border-[#e5e7eb] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]" />
        </div>

        {/* Table */}
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_80px_90px] gap-4 px-5 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb] text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span>标题</span><span>作者</span><span>年份</span><span>状态</span>
          </div>
          {papers.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-400">暂无文献，请上传 PDF 开始</div>
          )}
          {papers.map((paper) => (
            <div key={paper.id}
              className="grid grid-cols-[1fr_140px_80px_90px] gap-4 px-5 py-3 border-b border-[#f3f4f6] text-sm text-gray-700 hover:bg-[#fafafa] group">
              <span className="truncate font-medium">{paper.title}</span>
              <span className="truncate text-gray-500">{paper.authors || "未知"}</span>
              <span className="text-gray-500">{paper.year || "-"}</span>
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                  paper.status === "ingested" ? "bg-[#eef2f8] text-[#2c5282]"
                  : paper.status === "processing" ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
                }`}>
                  {paper.status === "ingested" ? "已入库" : paper.status === "processing" ? "处理中" : "失败"}
                </span>
                <button onClick={() => handleDelete(paper.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
