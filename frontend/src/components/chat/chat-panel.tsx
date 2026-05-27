"use client";
import { useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChat } from "@/hooks/use-chat";

export function ChatPanel() {
  const { messages, isStreaming, sendMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-heading text-[#1a2744] mb-1">
              材料科学文献助手
            </p>
            <p className="text-sm text-gray-500">
              上传文献后开始提问，基于文献获取专业回答
            </p>
          </div>
        </div>
      )}
      {messages.length > 0 && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              citations={msg.citations}
            />
          ))}
        </div>
      )}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
