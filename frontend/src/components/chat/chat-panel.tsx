"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChat } from "@/hooks/use-chat";

interface Props {
  onToggleSidebar: () => void;
}

export function ChatPanel({ onToggleSidebar }: Props) {
  const { messages, isStreaming, sendMessage } = useChat();

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            上传文献后开始提问
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
      </ScrollArea>
      <ChatInput onSend={sendMessage} disabled={isStreaming} onToggleSidebar={onToggleSidebar} />
    </div>
  );
}
