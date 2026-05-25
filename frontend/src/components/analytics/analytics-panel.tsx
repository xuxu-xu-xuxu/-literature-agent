"use client";
import { useEffect, useState } from "react";
import { BarChart3, LineChart, Loader2, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="h-full flex flex-col bg-slate-950">
      <div className="p-4 border-b border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          一键可视化
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" variant={kind === "element" ? "default" : "outline"} onClick={() => setKind("element")} className="gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            元素
          </Button>
          <Button size="sm" variant={kind === "method" ? "default" : "outline"} onClick={() => setKind("method")} className="gap-1">
            <PieChart className="w-3.5 h-3.5" />
            方法
          </Button>
          <Button size="sm" variant={kind === "temperature" ? "default" : "outline"} onClick={() => setKind("temperature")} className="gap-1">
            <LineChart className="w-3.5 h-3.5" />
            温度
          </Button>
        </div>
        {kind === "element" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant={metric === "avg" ? "default" : "outline"} onClick={() => setMetric("avg")}>平均值</Button>
            <Button size="sm" variant={metric === "median" ? "default" : "outline"} onClick={() => setMetric("median")}>中位数</Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        )}
        {error && <p className="p-4 text-sm text-red-400">{error}</p>}
        {!loading && result && (
          <>
            <ChartContainer option={result.echarts_option} title={result.title} />
            <div className="px-4 pb-4">
              <div className="overflow-x-auto rounded border border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900">
                      {Object.keys(result.data?.[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 text-left text-slate-400">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.data || []).map((row: Record<string, unknown>, i: number) => (
                      <tr key={i} className="border-t border-slate-800">
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="px-3 py-2 text-slate-300">{String(value)}</td>
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
