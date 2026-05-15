"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { LiteratureSidebar } from "@/components/sidebar/literature-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { VizPanel } from "@/components/viz/viz-panel";
import { fetchPapers, uploadPDF } from "@/lib/api";

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

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers();
      setPapers(data.items || []);
    } catch (e) {
      console.error("Failed to load papers", e);
    }
  }, []);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

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
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <div className="w-72 border-r border-slate-800 bg-slate-950 shrink-0">
            <LiteratureSidebar onClose={() => setSidebarOpen(false)} papers={papers} />
          </div>
        )}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 border-r border-slate-800">
            <ChatPanel onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          </div>
          <div className="w-96 shrink-0">
            <VizPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
