import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 px-6 py-4 ${isUser ? "bg-slate-900/50" : "bg-slate-950"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? "bg-blue-600" : "bg-emerald-600"}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        {isUser ? (
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_strong]:text-slate-100 [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-slate-800 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400 [&_a]:text-blue-400 [&_a]:underline [&_hr]:border-slate-700 [&_table]:border-collapse [&_th]:border [&_th]:border-slate-600 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-600 [&_td]:px-2 [&_td]:py-1">
            <ReactMarkdown>{content || "思考中..."}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
