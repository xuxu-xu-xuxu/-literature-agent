"use client";
import ReactECharts from "echarts-for-react";

interface Props {
  option: object;
  title: string;
}

const lightTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#374151" },
  legend: { textStyle: { color: "#6b7280" } },
};

export function ChartContainer({ option, title }: Props) {
  const mergedOption = {
    ...lightTheme,
    ...option,
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-heading font-semibold mb-3 text-[#1a2744]">
        {title}
      </h3>
      <div className="bg-white border border-[#e5e7eb] rounded-lg p-2">
        <ReactECharts option={mergedOption} style={{ height: "280px" }} />
      </div>
    </div>
  );
}
