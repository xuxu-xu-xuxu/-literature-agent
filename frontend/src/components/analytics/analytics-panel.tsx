"use client";
import { useEffect, useState } from "react";
import { BarChart3, LineChart, Loader2, PieChart } from "lucide-react";
import {
  fetchConductivityByElement,
  fetchConductivityByMethod,
  fetchConductivityByTemperature,
} from "@/lib/api";
import { ChartContainer } from "@/components/viz/chart-container";

type ChartKind = "element" | "method" | "temperature";

interface AnalyticsResult {
  chart_type: string;
  title: string;
  data: Record<string, unknown>[];
  echarts_option: object;
}

export function AnalyticsPanel() {
  const [kind, setKind] = useState<ChartKind>("element");
  const [metric, setMetric] = useState<"avg" | "median">("avg");
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (kind === "element") {
          setResult(await fetchConductivityByElement({ metric, confidence_min: 0.7 }));
        } else if (kind === "method") {
          setResult(await fetchConductivityByMethod());
        } else {
          setResult(await fetchConductivityByTemperature());
        }
      } catch {
        setError("加载统计图失败");
        setResult(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [kind, metric]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#e5e7eb] shrink-0">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#2c5282]" />
          一键可视化
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setKind("element")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              kind === "element"
                ? "bg-[#1a2744] text-white"
                : "bg-white border border-[#d1d5db] text-gray-600 hover:bg-[#fafafa]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            元素
          </button>
          <button
            onClick={() => setKind("method")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              kind === "method"
                ? "bg-[#1a2744] text-white"
                : "bg-white border border-[#d1d5db] text-gray-600 hover:bg-[#fafafa]"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            方法
          </button>
          <button
            onClick={() => setKind("temperature")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              kind === "temperature"
                ? "bg-[#1a2744] text-white"
                : "bg-white border border-[#d1d5db] text-gray-600 hover:bg-[#fafafa]"
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            温度
          </button>
        </div>
        {kind === "element" && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setMetric("avg")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metric === "avg"
                  ? "bg-[#1a2744] text-white"
                  : "bg-white border border-[#d1d5db] text-gray-600 hover:bg-[#fafafa]"
              }`}
            >
              平均值
            </button>
            <button
              onClick={() => setMetric("median")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metric === "median"
                  ? "bg-[#1a2744] text-white"
                  : "bg-white border border-[#d1d5db] text-gray-600 hover:bg-[#fafafa]"
              }`}
            >
              中位数
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#2c5282]" />
          </div>
        )}
        {error && <p className="p-4 text-sm text-red-500">{error}</p>}
        {!loading && result && (!result.data || result.data.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <BarChart3 className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">暂无数据</p>
            <p className="text-xs text-gray-400">请先在数据挖掘中抽取固态电解质记录</p>
          </div>
        )}
        {!loading && result && result.data && result.data.length > 0 && (
          <>
            <ChartContainer option={result.echarts_option} title={result.title} />
            <div className="px-4 pb-4">
              <div className="overflow-x-auto rounded border border-[#e5e7eb]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#fafafa]">
                      {Object.keys(result.data[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 text-left text-gray-500">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.data || []).map((row: Record<string, unknown>, i: number) => (
                      <tr key={i} className="border-t border-[#e5e7eb]">
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700">{String(value)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
