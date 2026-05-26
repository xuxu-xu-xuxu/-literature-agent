# Frontend 重新设计 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Literature Agent 前端从单页面堆叠布局重构为侧边导航 + 4 个独立页面，采用学术期刊风格（纯白底、深藏蓝强调、Georgia 衬线标题）。

**Architecture:** 在 Next.js 14 App Router 中创建 3 个新路由（/library, /analytics, /entities），在根 layout.tsx 中放置常驻 SideNav 组件，将现有 page.tsx 精简为纯聊天页面。所有共享组件（AnalyticsPanel、DataMiningPanel、EntityBrowser、VizPanel）被各页面独立引用，API 层不变。

**Tech Stack:** Next.js 14.2 App Router, TypeScript 5, Tailwind CSS 3.4, shadcn/ui, ECharts 6, Lucide React

---

### Task 1: 更新设计令牌（CSS 变量 + Tailwind 配置）

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1: 更新 globals.css 设计令牌**

将 `frontend/src/app/globals.css` 完整替换为：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg: 255 255 255;
  --color-surface: 250 250 250;
  --color-border: 229 229 229;
  --color-nav: 26 39 68;
  --color-primary: 26 39 68;
  --color-primary-light: 238 242 248;
  --color-text: 55 65 81;
  --color-text-secondary: 107 114 128;
  --color-success: 5 150 105;
  --color-link: 44 82 130;
}

body {
  background: rgb(var(--color-bg));
  color: rgb(var(--color-text));
  font-family: system-ui, -apple-system, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: Georgia, 'Times New Roman', serif;
}
```

- [ ] **Step 2: 更新 tailwind.config.ts**

将 `frontend/tailwind.config.ts` 完整替换为：

```typescript
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#1a2744",
          light: "#eef2f8",
        },
        nav: "#1a2744",
        surface: "#fafafa",
      },
      fontFamily: {
        heading: ["Georgia", "'Times New Roman'", "serif"],
        mono: ["'Courier New'", "monospace"],
      },
      borderRadius: {
        bubble: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/app/globals.css frontend/tailwind.config.ts
git commit -m "feat: update design tokens for academic journal style"
```

---

### Task 2: 创建 SideNav 侧边导航组件

**Files:**
- Create: `frontend/src/components/side-nav.tsx`

- [ ] **Step 1: 创建 SideNav 组件**

创建 `frontend/src/components/side-nav.tsx`：

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Library, BarChart3, Microscope } from "lucide-react";

const navItems = [
  { href: "/", label: "聊天", icon: MessageCircle },
  { href: "/library", label: "文献库", icon: Library },
  { href: "/analytics", label: "分析", icon: BarChart3 },
  { href: "/entities", label: "实体", icon: Microscope },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-col items-center gap-2 py-5 w-[72px] shrink-0"
      style={{ backgroundColor: "#1a2744" }}
    >
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-2 py-2 w-[56px] rounded-lg transition-colors ${
              isActive
                ? "bg-white/20 text-white"
                : "text-[#8fa4c0] opacity-50 hover:opacity-80"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-medium font-heading">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/side-nav.tsx
git commit -m "feat: add SideNav component with 4 navigation items"
```

---

### Task 3: 更新根布局 layout.tsx

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: 更新布局，集成 SideNav**

将 `frontend/src/app/layout.tsx` 完整替换为：

```tsx
import type { Metadata } from "next";
import { SideNav } from "@/components/side-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Literature Agent",
  description: "材料科学文献智能助手",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden flex">
        <SideNav />
        <main className="flex-1 min-w-0 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat: integrate SideNav into root layout, remove dark mode"
```

---

### Task 4: 重构 ChatMessage 气泡样式

**Files:**
- Modify: `frontend/src/components/chat/chat-message.tsx`

- [ ] **Step 1: 重写 ChatMessage 为气泡式布局**

将 `frontend/src/components/chat/chat-message.tsx` 完整替换为：

```tsx
import ReactMarkdown from "react-markdown";

interface Props {
  role: "user" | "assistant";
  content: string;
  citations?: { paper_id: string; title: string; author: string; year: number }[];
}

export function ChatMessage({ role, content, citations }: Props) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} px-4 py-2`}
    >
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Bubble */}
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "text-white rounded-bubble rounded-br-[2px]"
              : "text-gray-700 bg-[#f8f9fb] border border-[#e5e7eb] rounded-bubble rounded-bl-[2px]"
          }`}
          style={isUser ? { backgroundColor: "#1a2744" } : {}}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">{content}</span>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed
              [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-gray-900
              [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-100
              [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto
              [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
              [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500
              [&_a]:text-[#2c5282] [&_a]:underline [&_hr]:border-gray-200
              [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1
              [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1">
              <ReactMarkdown>{content || "思考中..."}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations for AI responses */}
        {!isUser && citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {citations.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#2c5282] bg-[#eef2f8] rounded"
              >
                {c.title} · {c.author} ({c.year})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/chat/chat-message.tsx
git commit -m "feat: redesign ChatMessage with bubble-style layout — user right, AI left"
```

---

### Task 5: 重构 ChatPanel 和 ChatInput

**Files:**
- Modify: `frontend/src/components/chat/chat-panel.tsx`
- Modify: `frontend/src/components/chat/chat-input.tsx`

- [ ] **Step 1: 更新 ChatPanel（移除 onToggleSidebar 依赖）**

将 `frontend/src/components/chat/chat-panel.tsx` 完整替换为：

```tsx
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
```

- [ ] **Step 2: 更新 ChatInput（移除 onToggleSidebar）**

将 `frontend/src/components/chat/chat-input.tsx` 完整替换为：

```tsx
"use client";
import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (query: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
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
    <div className="border-t border-[#e5e7eb] bg-white px-4 py-3">
      <div className="flex gap-2 items-end max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题... (Ctrl+Enter 发送)"
          rows={1}
          className="flex-1 border border-[#d1d5db] rounded-[10px] px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 resize-none focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="shrink-0 px-5 py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "#1a2744" }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/chat/chat-panel.tsx frontend/src/components/chat/chat-input.tsx
git commit -m "feat: refactor chat components — remove sidebar toggle, update styles"
```

---

### Task 6: 重构聊天页面 page.tsx

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: 精简为纯聊天页面 + 文献范围选择器**

将 `frontend/src/app/page.tsx` 完整替换为：

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { fetchPapers } from "@/lib/api";

interface Paper {
  id: string;
  title: string;
}

export default function ChatPage() {
  const [papers, setPapers] = useState<Paper[]>([]);

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers();
      setPapers(data.items || []);
    } catch {
      // silently fail — papers list is supplementary
    }
  }, []);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  return (
    <div className="h-full flex">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel />
      </div>

      {/* Scope selector sidebar */}
      <div className="w-44 shrink-0 border-l border-[#e5e7eb] bg-[#fafafa] p-4 hidden lg:block">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
          文献范围
        </p>
        <label className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#eef2f8]">
          <input
            type="radio"
            name="scope"
            defaultChecked
            className="accent-[#1a2744]"
          />
          <span className="text-xs text-gray-700">全部文献</span>
        </label>
        {papers.slice(0, 10).map((paper) => (
          <label
            key={paper.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#eef2f8]"
          >
            <input
              type="radio"
              name="scope"
              className="accent-[#1a2744]"
            />
            <span className="text-xs text-gray-700 truncate">
              {paper.title.slice(0, 20)}...
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: simplify chat page with scope selector sidebar"
```

---

### Task 7: 创建文献库页面 /library

**Files:**
- Create: `frontend/src/app/library/page.tsx`

- [ ] **Step 1: 创建文献库页面**

创建 `frontend/src/app/library/page.tsx`：

```tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Upload, Archive, Trash2 } from "lucide-react";
import {
  fetchPapers,
  uploadPDF,
  uploadBatchZip,
  deletePaper,
} from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  status: string;
}

export default function LibraryPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [keyword, setKeyword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const loadPapers = useCallback(async () => {
    try {
      const data = await fetchPapers({ keyword: keyword || undefined });
      setPapers(data.items || []);
    } catch {
      setError("加载文献列表失败");
    }
  }, [keyword]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  const filtered = papers.filter((p) =>
    keyword
      ? p.title.toLowerCase().includes(keyword.toLowerCase()) ||
        (p.authors || "").toLowerCase().includes(keyword.toLowerCase())
      : true
  );

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadPDF(file);
      await loadPapers();
    } catch {
      setError("上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleBatchUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadBatchZip(file, false);
      await loadPapers();
    } catch {
      setError("批量导入失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePaper(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading text-[#1a2744]">文献库</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {papers.length} 篇文献
            </p>
          </div>
          <div className="flex gap-3">
            <input
              ref={zipRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBatchUpload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => zipRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a2744] text-[#1a2744] rounded-lg text-sm font-medium hover:bg-[#eef2f8] disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              批量导入
            </button>
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => pdfRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#1a2744" }}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "上传中..." : "上传 PDF"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题、作者..."
            className="w-full pl-9 pr-4 py-2 border border-[#e5e7eb] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
          />
        </div>

        {/* Table */}
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_80px_90px] gap-4 px-5 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb] text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span>标题</span>
            <span>作者</span>
            <span>年份</span>
            <span>状态</span>
          </div>
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              暂无文献，请上传 PDF 开始
            </div>
          )}
          {filtered.map((paper) => (
            <div
              key={paper.id}
              className="grid grid-cols-[1fr_140px_80px_90px] gap-4 px-5 py-3 border-b border-[#f3f4f6] text-sm text-gray-700 hover:bg-[#fafafa] group"
            >
              <span className="truncate font-medium">{paper.title}</span>
              <span className="truncate text-gray-500">
                {paper.authors || "未知"}
              </span>
              <span className="text-gray-500">{paper.year || "-"}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    paper.status === "ingested"
                      ? "bg-[#eef2f8] text-[#2c5282]"
                      : paper.status === "processing"
                      ? "bg-green-50 text-green-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {paper.status === "ingested"
                    ? "已入库"
                    : paper.status === "processing"
                    ? "处理中"
                    : "失败"}
                </span>
                <button
                  onClick={() => handleDelete(paper.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/library/page.tsx
git commit -m "feat: add library page with search, upload, and paper management table"
```

---

### Task 8: 创建分析页面 /analytics

**Files:**
- Create: `frontend/src/app/analytics/page.tsx`
- Modify: `frontend/src/components/viz/chart-container.tsx`

- [ ] **Step 1: 更新 ChartContainer（适配浅色主题）**

将 `frontend/src/components/viz/chart-container.tsx` 完整替换为：

```tsx
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
```

- [ ] **Step 2: 更新 AnalyticsPanel 和 DataMiningPanel 样式**

两个组件都有硬编码的深色主题 class（`bg-slate-950`、`border-slate-800`、`text-slate-*`），需要更新为浅色学术风格。

更新 `frontend/src/components/analytics/analytics-panel.tsx` 的根容器 class：
```
// 将以下 class 替换
className="h-full flex flex-col bg-slate-950"
// → 移除 bg-slate-950（由父级背景决定，无需指定）

// 将所有 border-slate-800 → border-[#e5e7eb]
// 将所有 bg-slate-900 → bg-[#fafafa]
// 将所有 text-slate-* → 对应的 text-gray-* (slate-400→gray-400, slate-500→gray-500, etc.)
// 将所有 text-blue-400 → text-[#2c5282]
```

更新 `frontend/src/components/mining/data-mining-panel.tsx` 的根容器 class：
```
// 将以下 class 替换
className="h-full flex flex-col bg-slate-950"
// → 移除 bg-slate-950

// 将所有 border-slate-800 → border-[#e5e7eb]
// 将所有 bg-slate-900 → bg-[#fafafa]
// 将所有 bg-slate-900/60 → bg-white
// 将所有 text-slate-* → 对应的 text-gray-*
// 将所有 text-emerald-* → 保留 emerald
// 将所有 bg-emerald-600 → 保留 emerald
```

- [ ] **Step 3: 创建分析页面**

创建 `frontend/src/app/analytics/page.tsx`：

```tsx
"use client";
import { useState } from "react";
import { Pickaxe } from "lucide-react";
import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { DataMiningPanel } from "@/components/mining/data-mining-panel";
import { fetchPapers } from "@/lib/api";

interface Paper {
  id: string;
  title: string;
  status: string;
}

export default function AnalyticsPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoaded, setPapersLoaded] = useState(false);

  if (!papersLoaded) {
    fetchPapers()
      .then((data) => setPapers(data.items || []))
      .catch(() => {})
      .finally(() => setPapersLoaded(true));
  }

  return (
    <div className="h-full flex">
      {/* Main: Charts */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-heading text-[#1a2744] mb-1">数据分析</h1>
          <p className="text-sm text-gray-500 mb-6">
            固态电解质电导率统计 & 数据抽取
          </p>
          <AnalyticsPanel />
        </div>
      </div>

      {/* Right: Data Mining Panel */}
      <div className="w-56 shrink-0 border-l border-[#e5e7eb] bg-[#fafafa] p-4 overflow-y-auto">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Pickaxe className="w-3.5 h-3.5" />
          数据挖掘
        </h3>
        <DataMiningPanel papers={papers} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/app/analytics/page.tsx frontend/src/components/viz/chart-container.tsx frontend/src/components/analytics/analytics-panel.tsx frontend/src/components/mining/data-mining-panel.tsx
git commit -m "feat: add analytics page with charts and data mining panel, update light theme styles"
```

---

### Task 9: 创建实体页面 /entities

**Files:**
- Create: `frontend/src/app/entities/page.tsx`

- [ ] **Step 1: 更新 EntityBrowser 和 VizPanel 样式**

两个组件有硬编码深色主题 class，需要适配：

更新 `frontend/src/components/viz/entity-browser.tsx`：
```
// 将所有 bg-slate-950 → 移除（由父级背景决定）
// 将所有 bg-slate-900 → bg-[#fafafa]
// 将所有 border-slate-800 → border-[#e5e7eb]
// 将所有 text-slate-* → 对应的 text-gray-*
// 将所有 text-blue-400 → text-[#2c5282]
```

更新 `frontend/src/components/viz/viz-panel.tsx`：
```
// 同上替换规则
```

- [ ] **Step 2: 创建实体页面**

创建 `frontend/src/app/entities/page.tsx`：

```tsx
"use client";
import { useState } from "react";
import { EntityBrowser } from "@/components/viz/entity-browser";
import { VizPanel } from "@/components/viz/viz-panel";

export default function EntitiesPage() {
  const [tab, setTab] = useState<"browse" | "viz">("browse");

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-6 pt-8 pb-0">
        <h1 className="text-2xl font-heading text-[#1a2744] mb-1">实体数据</h1>
        <p className="text-sm text-gray-500">
          浏览提取的知识实体 & 自然语言可视化
        </p>

        {/* Tabs */}
        <div className="flex gap-0 mt-5 border-b-2 border-[#e5e7eb]">
          <button
            onClick={() => setTab("browse")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              tab === "browse"
                ? "text-[#1a2744] border-[#1a2744]"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            实体浏览
          </button>
          <button
            onClick={() => setTab("viz")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-0.5 ${
              tab === "viz"
                ? "text-[#1a2744] border-[#1a2744]"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            智能可视化
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "browse" && <EntityBrowser />}
        {tab === "viz" && <VizPanel />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/app/entities/page.tsx frontend/src/components/viz/entity-browser.tsx frontend/src/components/viz/viz-panel.tsx
git commit -m "feat: add entities page with entity browser and visualization tabs, update light theme"
```

---

### Task 10: 清理和验证

**Files:**
- Modify: `frontend/src/components/header.tsx`（不再需要，保留为占位或删除其引用）
- Build and verify

- [ ] **Step 1: 删除旧的 Header 引用，清理未使用的导入**

检查 `frontend/src/app/page.tsx` 不再引用 Header（已在 Task 6 中移除）。确认 `frontend/src/components/header.tsx` 中的 Upload / BatchUpload 逻辑已迁移到 Library 页面。

Header 组件现在没有页面引用它，可以保留在文件系统中（后续可能用于其他功能），但确保没有编译错误。

- [ ] **Step 2: 构建前端验证**

```bash
cd frontend && npm run build
```

Expected: 构建成功，无 TypeScript 错误，无路由解析错误。

- [ ] **Step 3: 修复构建中出现的任何问题**

根据构建输出，修复以下可能的问题：
- 未使用的导入警告
- TypeScript 类型错误
- 缺失的组件引用

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: cleanup unused imports and finalize frontend redesign"
```
