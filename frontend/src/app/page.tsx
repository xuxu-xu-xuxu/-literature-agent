"use client";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel />
      </div>
    </div>
  );
}
