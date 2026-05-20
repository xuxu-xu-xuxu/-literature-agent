"use client";
import ReactECharts from "echarts-for-react";

interface Props {
  option: object;
  title: string;
}

const darkTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#94a3b8" },
  legend: { textStyle: { color: "#94a3b8" } },
};

export function ChartContainer({ option, title }: Props) {
  const mergedOption = {
    ...darkTheme,
    ...option,
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-slate-300">{title}</h3>
      <div className="bg-slate-900 rounded-lg p-2">
        <ReactECharts option={mergedOption} style={{ height: "280px" }} />
      </div>
    </div>
  );
}
