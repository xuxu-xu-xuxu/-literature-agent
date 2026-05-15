"use client";
import ReactECharts from "echarts-for-react";

interface Props {
  option: object;
  title: string;
}

export function ChartContainer({ option, title }: Props) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-slate-300">{title}</h3>
      <div className="bg-slate-900 rounded-lg p-2">
        <ReactECharts option={option} style={{ height: "280px" }} theme="dark" />
      </div>
    </div>
  );
}
