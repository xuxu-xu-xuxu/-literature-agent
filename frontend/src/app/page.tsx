"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { LiteratureSidebar } from "@/components/sidebar/literature-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { VizPanel } from "@/components/viz/viz-panel";
import { EntityBrowser } from "@/components/viz/entity-browser";
import { fetchPapers, uploadPDF, deletePaper, triggerExtraction } from "@/lib/api";
import { BarChart3, Database } from "lucide-react";

interface Paper {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  status: string;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rightTab, setRightTab] = useState<"viz" | "entities">("viz");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers();
      setPapers(data.items || []);
    } catch (e) {
      console.error("Failed to load papers", e);
    }
  }, []);

  useEffect(() => {
    const hasProcessing = papers.some((p) => p.status === "processing");
    if (hasProcessing && !timerRef.current) {
      timerRef.current = setInterval(loadPapers, 3000);
    } else if (!hasProcessing && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [papers, loadPapers]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  const handleDelete = async (id: string) => {
    try {
      await deletePaper(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setErrorMsg(e.message || "删除失败，请重试");
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const handleExtract = async (id: string) => {
    try {
      await triggerExtraction(id);
      setRightTab("entities");
    } catch (e) {
      console.error("Extraction failed", e);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadPDF(file);
      await loadPapers();
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Header onUpload={handleUpload} uploading={uploading} />
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg">
          {errorMsg}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <div className="w-72 border-r border-slate-800 bg-slate-950 shrink-0">
            <LiteratureSidebar
              onClose={() => setSidebarOpen(false)}
              papers={papers}
              onDelete={handleDelete}
              onExtract={handleExtract}
            />
          </div>
        )}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 border-r border-slate-800">
            <ChatPanel onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          </div>
          <div className="w-96 shrink-0 flex flex-col">
            {/* Tab bar */}
            <div className="flex border-b border-slate-800 bg-slate-950 shrink-0">
              <button
                onClick={() => setRightTab("viz")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === "viz"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                可视化
              </button>
              <button
                onClick={() => setRightTab("entities")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === "entities"
                    ? "text-emerald-400 border-b-2 border-emerald-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                实体数据
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {rightTab === "viz" ? <VizPanel /> : <EntityBrowser />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
