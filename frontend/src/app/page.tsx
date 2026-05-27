"use client";
import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { fetchPapers } from "@/lib/api";

interface Paper {
  id: string;
  title: string;
}

export default function ChatPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [scopePaperId, setScopePaperId] = useState<string>("");

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers();
      setPapers(data.items || []);
    } catch {
      // silently fail — papers list is supplementary
    }
  }, []);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  return (
    <div className="h-full flex">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel scopePaperId={scopePaperId || undefined} />
      </div>

      {/* Scope selector sidebar */}
      <div className="w-44 shrink-0 border-l border-[#e5e7eb] bg-[#fafafa] p-4 hidden lg:block">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
          文献范围
        </p>
        <label className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#eef2f8]">
          <input
            type="radio"
            name="scope"
            checked={scopePaperId === ""}
            onChange={() => setScopePaperId("")}
            className="accent-[#1a2744]"
          />
          <span className="text-xs text-gray-700">全部文献</span>
        </label>
        {papers.slice(0, 10).map((paper) => (
          <label
            key={paper.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#eef2f8]"
          >
            <input
              type="radio"
              name="scope"
              checked={scopePaperId === paper.id}
              onChange={() => setScopePaperId(paper.id)}
              className="accent-[#1a2744]"
            />
            <span className="text-xs text-gray-700 truncate">
              {paper.title.slice(0, 20)}...
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
