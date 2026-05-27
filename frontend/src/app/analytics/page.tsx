"use client";
import { useState } from "react";
import { Pickaxe } from "lucide-react";
import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { DataMiningPanel } from "@/components/mining/data-mining-panel";
import { fetchPapers } from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  status: string;
}

export default function AnalyticsPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoaded, setPapersLoaded] = useState(false);

  if (!papersLoaded) {
    fetchPapers()
      .then((data) => setPapers(data.items || []))
      .catch(() => {})
      .finally(() => setPapersLoaded(true));
  }

  return (
    <div className="h-full flex">
      {/* Main: Charts */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-heading text-[#1a2744] mb-1">数据分析</h1>
          <p className="text-sm text-gray-500 mb-6">
            固态电解质电导率统计 & 数据抽取
          </p>
          <AnalyticsPanel />
        </div>
      </div>

      {/* Right: Data Mining Panel */}
      <div className="w-56 shrink-0 border-l border-[#e5e7eb] bg-[#fafafa] p-4 overflow-y-auto">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Pickaxe className="w-3.5 h-3.5" />
          数据挖掘
        </h3>
        <DataMiningPanel papers={papers} />
      </div>
    </div>
  );
}
