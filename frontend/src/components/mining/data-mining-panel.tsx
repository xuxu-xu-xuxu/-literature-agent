"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Loader2, Pickaxe, RefreshCw, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchIngestionJobs,
  fetchSolidElectrolyteRecords,
  triggerSolidElectrolyteExtraction,
} from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  status: string;
}

interface RecordRow {
  id: number;
  paper_id: string;
  material_formula: string;
  conductivity_s_cm: number | null;
  temperature_k: number | null;
  method: string;
  is_crystalline: boolean | null;
  crystallinity: string;
  confidence: number;
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

export function DataMiningPanel({ papers }: { papers: Paper[] }) {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [recordData, jobData] = await Promise.all([
        fetchSolidElectrolyteRecords({ page_size: 200 }),
        fetchIngestionJobs(),
      ]);
      setRecords(recordData.items || []);
      setJobs(jobData.items || []);
      return jobData.items || [];
    } catch {
      setError("加载数据挖掘结果失败");
      return [];
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-poll when there are active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(
      (j) => j.status === "extracting" || j.status === "queued" || j.status === "running"
    );
    if (activeJobs.length > 0 && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (activeJobs.length === 0 && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs, load]);

  const runExtraction = async (paperId: string) => {
    setExtractingId(paperId);
    setError("");
    try {
      await triggerSolidElectrolyteExtraction(paperId);
      await load();
    } catch {
      setError("抽取失败，请检查后端日志或 LLM 配置");
    } finally {
      setExtractingId(null);
    }
  };

  const runAll = async () => {
    setLoading(true);
    for (const paper of papers.filter((p) => p.status === "ingested")) {
      await runExtraction(paper.id);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#e5e7eb] shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Pickaxe className="w-4 h-4 text-[#1a2744]" />
            数据挖掘
          </h2>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </Button>
        </div>
        <Button
          size="sm"
          className="mt-3 w-full gap-1.5 bg-[#1a2744] hover:bg-[#2d3f5e] text-white"
          onClick={runAll}
          disabled={loading || extractingId !== null}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          对已入库文献抽取固态电解质数据
        </Button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      <div className="p-3 border-b border-[#e5e7eb]">
        <p className="text-xs text-gray-500 mb-2">最近批量导入任务</p>
        <div className="space-y-2 max-h-28 overflow-y-auto">
          {jobs.slice(0, 3).map((job) => (
            <div key={job.id} className="text-xs bg-[#fafafa] border border-[#e5e7eb] rounded p-2">
              <div className="flex justify-between text-gray-700">
                <span className="flex items-center gap-1">
                  {job.status === "extracting" && <FileArchive className="w-3 h-3 text-[#1a2744]" />}
                  {job.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-[#1a2744]" />}
                  {job.status === "queued" && "⏳ "}
                  {job.status === "extracting" ? "解压中" : job.status === "queued" ? "排队中" : job.status === "running" ? "处理中" : job.status === "done" ? "已完成" : job.status === "partial_failed" ? "部分失败" : job.status}
                </span>
                <span>{job.succeeded + job.failed + job.duplicate}/{job.total || "?"}</span>
              </div>
              {job.current_file && <div className="text-gray-500 truncate mt-1">{job.current_file}</div>}
              {job.status === "running" && job.total > 0 && (
                <div className="mt-1.5 bg-[#e5e7eb] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#1a2744] h-full rounded-full transition-all duration-500"
                    style={{ width: `${((job.succeeded + job.failed + job.duplicate) / job.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ))}
          {jobs.length === 0 && <p className="text-xs text-gray-400">暂无批量任务</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {records.map((record) => (
            <div key={record.id} className="rounded border border-[#e5e7eb] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm text-gray-900">{record.material_formula}</div>
                <span className="text-[11px] text-gray-500">{record.method}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>电导率: {record.conductivity_s_cm?.toExponential(2) ?? "-" } S/cm</span>
                <span>温度: {record.temperature_k ? `${record.temperature_k.toFixed(1)} K` : "-"}</span>
                <span>晶体态: {record.is_crystalline === null ? "未知" : record.is_crystalline ? "是" : "否"}</span>
                <span>形态: {record.crystallinity || "unknown"}</span>
                <span>置信度: {record.confidence.toFixed(2)}</span>
                <span className="truncate">文献: {record.paper_id}</span>
              </div>
            </div>
          ))}
          {records.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">
              暂无结构化记录。上传文献后点击抽取按钮生成化学式、电导率、温度和方法数据。
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-[#e5e7eb] max-h-44 overflow-y-auto">
        <p className="text-xs text-gray-500 mb-2">单篇抽取</p>
        <div className="space-y-1">
          {papers.filter((p) => p.status === "ingested").slice(0, 20).map((paper) => (
            <button
              key={paper.id}
              onClick={() => runExtraction(paper.id)}
              disabled={extractingId !== null}
              className="w-full text-left text-xs px-2 py-1.5 rounded bg-[#fafafa] hover:bg-[#f0f0f0] text-gray-700 disabled:opacity-50 truncate"
            >
              {extractingId === paper.id ? "抽取中..." : paper.title.replace(/\.pdf$/i, "")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
