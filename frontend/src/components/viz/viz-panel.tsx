import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartContainer } from "./chart-container";
import { BarChart3 } from "lucide-react";

export function VizPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          分析面板
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex items-center justify-center h-full text-slate-500 text-sm py-8">
          在对话框中提问后，图表将展示在这里
        </div>
      </ScrollArea>
    </div>
  );
}
