"use client";
import { useRef } from "react";
import { BookOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onUpload: (file: File) => void;
  uploading: boolean;
}

export function Header({ onUpload, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-blue-400" />
        <span className="font-semibold text-base">Literature Agent</span>
        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">文献库</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onUpload(file);
            e.target.value = "";
          }
        }}
      />
      <Button
        size="sm"
        className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="w-4 h-4" />
        {uploading ? "上传中..." : "上传 PDF"}
      </Button>
    </header>
  );
}
