"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Upload, Archive, Trash2 } from "lucide-react";
import {
  fetchPapers,
  uploadPDF,
  uploadBatchZip,
  deletePaper,
} from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  status: string;
}

export default function LibraryPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [keyword, setKeyword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers({ keyword: keyword || undefined });
      setPapers(data.items || []);
    } catch {
      setError("加载文献列表失败");
    }
  }, [keyword]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // Auto-poll when there are papers being processed
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasProcessing = papers.some((p) => p.status === "processing");
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(loadPapers, 3000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [papers, loadPapers]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadPDF(file);
      await loadPapers();
    } catch {
      setError("上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleBatchUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadBatchZip(file, false);
      await loadPapers();
    } catch {
      setError("批量导入失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePaper(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
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
            <input
              ref={zipRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBatchUpload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => zipRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a2744] text-[#1a2744] rounded-lg text-sm font-medium hover:bg-[#eef2f8] disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              批量导入
            </button>
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => pdfRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#1a2744" }}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "上传中..." : "上传 PDF"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题..."
            className="w-full pl-9 pr-4 py-2 border border-[#e5e7eb] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
          />
        </div>

        {/* Table */}
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_80px_90px] gap-4 px-5 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb] text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span>标题</span>
            <span>作者</span>
            <span>年份</span>
            <span>状态</span>
          </div>
          {papers.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              暂无文献，请上传 PDF 开始
            </div>
          )}
          {papers.map((paper) => (
            <div
              key={paper.id}
              className="grid grid-cols-[1fr_140px_80px_90px] gap-4 px-5 py-3 border-b border-[#f3f4f6] text-sm text-gray-700 hover:bg-[#fafafa] group"
            >
              <span className="truncate font-medium">{paper.title}</span>
              <span className="truncate text-gray-500">
                {paper.authors || "未知"}
              </span>
              <span className="text-gray-500">{paper.year || "-"}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    paper.status === "ingested"
                      ? "bg-[#eef2f8] text-[#2c5282]"
                      : paper.status === "processing"
                      ? "bg-green-50 text-green-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {paper.status === "ingested"
                    ? "已入库"
                    : paper.status === "processing"
                    ? "处理中"
                    : "失败"}
                </span>
                <button
                  onClick={() => handleDelete(paper.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
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
