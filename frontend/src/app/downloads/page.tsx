"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileDown, Loader2 } from "lucide-react";
import {
  createDownload,
  fetchDomains,
  fetchDownloads,
  ingestDownload,
} from "@/lib/api";
import { DomainMatrix, type LibraryDomainSummary } from "@/components/library/domain-matrix";

interface DownloadItem {
  id: string;
  identifier: string;
  doi: string | null;
  title: string | null;
  source: string | null;
  strategy: string;
  file_path: string | null;
  paper_id: string | null;
  status: string;
  error: string | null;
}

export default function DownloadsPage() {
  const [domains, setDomains] = useState<LibraryDomainSummary[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [importDomainId, setImportDomainId] = useState("solid-state");
  const [downloadIdentifier, setDownloadIdentifier] = useState("");
  const [downloadStrategy, setDownloadStrategy] = useState("legal_only");
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "info" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDomains = useCallback(async () => {
    try {
      const data = await fetchDomains();
      setDomains(data || []);
      if (!selectedDomainId && data?.length) {
        setImportDomainId(data[0].id);
      }
    } catch {
      setDomains([]);
    }
  }, [selectedDomainId]);

  const loadDownloads = useCallback(async () => {
    try {
      const data = await fetchDownloads();
      setDownloads(data.items || []);
    } catch {
      setDownloads([]);
    }
  }, []);

  useEffect(() => {
    loadDomains();
    loadDownloads();
  }, [loadDomains, loadDownloads]);

  useEffect(() => {
    const hasActive = downloads.some((download) => ["downloading", "ingesting"].includes(download.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadDownloads();
      }, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [downloads, loadDownloads]);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) || null,
    [domains, selectedDomainId]
  );

  const handleCreateDownload = async () => {
    const identifier = downloadIdentifier.trim();
    if (!identifier) {
      setMessage({ text: "请输入 DOI 或 arXiv ID", type: "error" });
      return;
    }
    setDownloading(true);
    setMessage(null);
    try {
      await createDownload(identifier, downloadStrategy);
      setDownloadIdentifier("");
      await loadDownloads();
    } catch {
      setMessage({ text: "下载任务创建失败", type: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const toggleDownloadSelection = (downloadId: string) => {
    setSelectedDownloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(downloadId)) {
        next.delete(downloadId);
      } else {
        next.add(downloadId);
      }
      return next;
    });
  };

  const handleIngestDownload = async (downloadId: string) => {
    setIngesting(true);
    setMessage(null);
    try {
      await ingestDownload(downloadId, importDomainId);
      setSelectedDownloadIds((prev) => {
        const next = new Set(prev);
        next.delete(downloadId);
        return next;
      });
      await loadDownloads();
      await loadDomains();
    } catch {
      setMessage({ text: "下载文献导入失败", type: "error" });
    } finally {
      setIngesting(false);
    }
  };

  const handleIngestSelectedDownloads = async () => {
    const readyIds = downloads
      .filter((download) => selectedDownloadIds.has(download.id) && download.status === "downloaded")
      .map((download) => download.id);
    if (readyIds.length === 0) {
      setMessage({ text: "请先选中已下载的文献", type: "error" });
      return;
    }

    setIngesting(true);
    setMessage(null);
    try {
      for (const downloadId of readyIds) {
        await ingestDownload(downloadId, importDomainId);
      }
      setSelectedDownloadIds(new Set());
      await loadDownloads();
      await loadDomains();
    } catch {
      setMessage({ text: "选中文献导入失败", type: "error" });
    } finally {
      setIngesting(false);
    }
  };

  const downloadStatusLabel = (status: string) => {
    switch (status) {
      case "downloading":
        return "下载中";
      case "downloaded":
        return "已下载";
      case "ingesting":
        return "导入中";
      case "ingested":
        return "已入库";
      case "failed":
        return "失败";
      default:
        return status;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-heading text-[#1a2744]">文献下载</h1>
            <p className="mt-1 text-sm text-gray-500">
              输入 DOI 或 arXiv ID，下载后再导入到指定领域文献库。
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={downloadIdentifier}
              onChange={(e) => setDownloadIdentifier(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDownload();
              }}
              placeholder="输入 DOI 或 arXiv ID"
              className="w-full min-w-[260px] rounded-md border border-[#d1d5db] px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#1a2744] focus:outline-none"
            />
            <select
              value={downloadStrategy}
              onChange={(e) => setDownloadStrategy(e.target.value)}
              className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#1a2744] focus:outline-none"
            >
              <option value="legal_only">合法来源</option>
              <option value="oa_first">开放优先</option>
              <option value="fastest">最快策略</option>
            </select>
            <button
              onClick={handleCreateDownload}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1a2744] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#24395f] disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              下载
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-blue-200 bg-blue-50 text-blue-600"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2744]">领域矩阵</h2>
              <p className="mt-1 text-xs text-gray-500">
                下载完成后，选中文献并导入到下方目标领域。
              </p>
            </div>
            <div className="text-xs text-gray-500">
              导入目标领域：{selectedDomain?.name || domains.find((domain) => domain.id === importDomainId)?.name || importDomainId}
            </div>
          </div>

          <DomainMatrix
            domains={domains}
            selectedDomainId={selectedDomainId}
            onSelectDomain={(domainId) => {
              setSelectedDomainId(domainId);
              if (domainId) setImportDomainId(domainId);
            }}
          />
        </section>

        <section className="mt-6 border-t border-[#e5e7eb] pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#1a2744]">下载任务</h2>
              <p className="mt-1 text-xs text-gray-500">
                勾选已下载任务，一键导入到当前目标领域。
              </p>
            </div>
            <button
              onClick={handleIngestSelectedDownloads}
              disabled={ingesting || selectedDownloadIds.size === 0}
              className="inline-flex items-center gap-2 rounded-md border border-[#1a2744] px-3 py-1.5 text-xs font-medium text-[#1a2744] transition-colors hover:bg-[#eef2f8] disabled:opacity-40"
            >
              <FileDown className="h-3.5 w-3.5" />
              导入选中
            </button>
          </div>

          <div className="space-y-2">
            {downloads.map((download) => {
              const ready = download.status === "downloaded" || (download.status === "failed" && !!download.file_path);
              const selected = selectedDownloadIds.has(download.id);
              return (
                <div
                  key={download.id}
                  className="grid gap-3 rounded-lg border border-[#e5e7eb] p-3 text-sm text-gray-700 lg:grid-cols-[28px_1fr_96px_96px]"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!ready}
                    onChange={() => toggleDownloadSelection(download.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                    aria-label="选择下载文献"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {download.title || download.doi || download.identifier}
                    </div>
                    <div className="mt-1 truncate text-xs text-gray-500">
                      {download.source ? `来源 ${download.source}` : "等待下载结果"}
                      {download.file_path ? ` · ${download.file_path}` : ""}
                    </div>
                    {download.error && <div className="mt-1 text-xs text-red-500">{download.error}</div>}
                  </div>
                  <span
                    className={`h-fit rounded px-2 py-1 text-center text-xs font-medium ${
                      download.status === "downloaded"
                        ? "bg-blue-50 text-blue-600"
                        : download.status === "ingested"
                          ? "bg-[#eef2f8] text-[#2c5282]"
                          : download.status === "failed"
                            ? "bg-red-50 text-red-600"
                            : "bg-green-50 text-green-600"
                    }`}
                  >
                    {downloadStatusLabel(download.status)}
                  </span>
                  <button
                    onClick={() => handleIngestDownload(download.id)}
                    disabled={!ready || ingesting}
                    className="h-fit rounded-md bg-[#1a2744] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#24395f] disabled:opacity-40"
                  >
                    导入
                  </button>
                </div>
              );
            })}
            {downloads.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#d1d5db] px-4 py-6 text-center text-sm text-gray-400">
                暂无下载任务
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
