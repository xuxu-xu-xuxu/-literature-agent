"use client";
import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Send, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (query: string) => void;
  disabled: boolean;
  onToggleSidebar: () => void;
}

export function ChatInput({ onSend, disabled, onToggleSidebar }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="border-t border-slate-800 bg-slate-950 p-4">
      <div className="flex gap-2 items-end">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-9 w-9 shrink-0">
          <PanelLeft className="w-4 h-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题... (Ctrl+Enter 发送)"
          rows={1}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:border-blue-500"
        />
        <Button onClick={handleSend} disabled={disabled || !input.trim()} size="sm" className="shrink-0 bg-blue-600 hover:bg-blue-500">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
