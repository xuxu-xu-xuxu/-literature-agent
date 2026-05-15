import { User, Bot } from "lucide-react";

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
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
          {content || (isUser ? "" : "思考中...")}
        </div>
      </div>
    </div>
  );
}
