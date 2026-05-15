interface PaperCardProps {
  paper: { id: string; title: string; authors: string | null; year: number | null; status: string };
}

export function PaperCard({ paper }: PaperCardProps) {
  return (
    <div className="mb-1 p-3 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-800">
      <h3 className="text-sm font-medium line-clamp-2 leading-snug">{paper.title}</h3>
      <p className="text-xs text-slate-500 mt-1">
        {paper.authors || "未知作者"} · {paper.year || "未知年份"}
        {paper.status === "processing" && (
          <span className="ml-2 text-yellow-500">处理中...</span>
        )}
      </p>
    </div>
  );
}
