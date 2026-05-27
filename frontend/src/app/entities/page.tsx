"use client";
import { useState } from "react";
import { EntityBrowser } from "@/components/viz/entity-browser";
import { VizPanel } from "@/components/viz/viz-panel";

export default function EntitiesPage() {
  const [tab, setTab] = useState<"browse" | "viz">("browse");

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-6 pt-8 pb-0">
        <h1 className="text-2xl font-heading text-[#1a2744] mb-1">实体数据</h1>
        <p className="text-sm text-gray-500">
          浏览提取的知识实体 & 自然语言可视化
        </p>

        {/* Tabs */}
        <div className="flex gap-0 mt-5 border-b-2 border-[#e5e7eb]">
          <button
            onClick={() => setTab("browse")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              tab === "browse"
                ? "text-[#1a2744] border-[#1a2744]"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            实体浏览
          </button>
          <button
            onClick={() => setTab("viz")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              tab === "viz"
                ? "text-[#1a2744] border-[#1a2744]"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            智能可视化
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "browse" && <EntityBrowser />}
        {tab === "viz" && <VizPanel />}
      </div>
    </div>
  );
}
