# Frontend 重新设计 — 设计文档

## 概述

将 Literature Agent 前端从单页面堆叠布局重构为侧边导航 + 独立页面架构，采用学术期刊风格的视觉设计。

**当前状态：** 所有功能挤在一个页面（`page.tsx`），左侧可切换文献列表、中间聊天、右侧 tab 面板（统计图/挖掘/智能/实体）。

**目标：** 左侧常驻垂直导航栏，4 个独立页面，学术期刊风格（纯白底色、深藏蓝强调、Georgia 衬线标题）。

## 架构

### 路由结构

使用 Next.js 14 App Router 文件系统路由：

```
frontend/src/app/
├── layout.tsx          # 根布局：侧边导航 + 内容区
├── page.tsx            # 默认页面 → 聊天（首页）
├── library/
│   └── page.tsx        # 文献库页面
├── analytics/
│   └── page.tsx        # 分析页面
├── entities/
│   └── page.tsx        # 实体页面
└── globals.css         # 全局样式
```

### 组件树

```
RootLayout
├── SideNav                    # 左侧常驻导航栏（4 项 + 图标 + 文字）
└── {children}                 # Next.js 页面内容区（通过路由切换）

Pages:
  ChatPage (/)                 # 默认首页
  ├── ChatPanel                # 对话消息列表 + 气泡布局
  ├── ChatInput                # 输入框 + 发送按钮
  └── ScopeSelector            # 右侧文献范围选择器

  LibraryPage (/library)
  ├── LibraryHeader            # 标题 + 上传按钮 + 批量导入
  ├── SearchBar                # 搜索 + 筛选
  └── PaperTable               # 文献列表表格

  AnalyticsPage (/analytics)
  ├── ChartArea                # ECharts 图表区域
  │   ├── ChartTabs            # 按元素/按方法/按温度
  │   └── ChartContainer       # 复用现有组件
  └── MiningPanel              # 数据挖掘面板（右侧）

  EntitiesPage (/entities)
  ├── EntitiesTab              # 实体浏览 Tab
  │   └── EntityBrowser        # 复用现有组件
  └── VizTab                   # 智能可视化 Tab
      └── VizPanel             # 复用现有组件
```

### 导航结构

```
┌──────────────────┐
│       💬         │
│      聊天        │  ← 默认首页，当前激活项：深藏蓝底高亮
│                  │
│       📚         │
│     文献库       │
│                  │
│       📊         │
│      分析        │
│                  │
│       🔬         │
│      实体        │
└──────────────────┘
  72px 宽深藏蓝侧边栏
```

## 页面设计

### 聊天页面（默认首页 `/`）

**布局：** 三栏 — 侧栏(72px) | 对话区(flex-1) | 范围选择器(160px)

**对话气泡规则：**
- 用户消息：深蓝背景(#1a2744)白字，靠右对齐，圆角 12px 12px 2px 12px
- AI 回答：浅灰背景(#f8f9fb)黑字，靠左对齐，圆角 12px 12px 12px 2px
- AI 回答底部附带文献引用标签（浅蓝底色，显示作者+年份+期刊）
- 流式输出时，AI 气泡实时增长

**右侧范围选择器：**
- 显示"文献范围"标签
- 单选："全部文献" / 特定文献
- 影响后端 `scope_paper_ids` 参数

**底部输入区：**
- 输入框 + 发送按钮，固定在对话区底部
- 支持 Enter 发送

### 文献库页面（`/library`）

**布局：** 侧栏 + 内容区全宽

**顶部：** 页面标题 + 文献计数 + 上传 PDF（主按钮）+ 批量导入（次按钮）

**搜索栏：** 搜索框（标题/作者/年份）+ 筛选下拉

**文献列表：**
- 表格形式：标题 | 作者 | 年份 | 状态
- 状态用彩色标签：已入库(蓝色) / 处理中(绿色) / 失败(红色)
- 支持点击行展开详情（摘要、全文预览）
- 支持删除操作

### 分析页面（`/analytics`）

**布局：** 侧栏 + 图表区(flex-1) | 数据挖掘面板(180px)

**图表区：** 3 个 Tab 切换
- 按元素 — 柱状图，支持 avg/median 切换
- 按方法 — 柱状图
- 按温度 — 散点图
- 复用 `AnalyticsPanel` 组件

**右侧数据挖掘面板：**
- "抽取固态电解质数据"按钮
- 从已入库文献中批量抽取
- 列出已抽取的记录（化学式、电导率、方法）
- 复用 `DataMiningPanel` 组件

### 实体页面（`/entities`）

**布局：** 侧栏 + 内容区全宽

**双 Tab 切换：**
- 实体浏览 Tab：复 `EntityBrowser` 组件
- 智能可视化 Tab：复用 `VizPanel` 组件

**Tab 样式：** 下划线指示器，激活 tab 用深藏蓝底部边框

## 视觉设计系统

### 配色

```
--color-bg:          #ffffff   页面背景（纯白）
--color-surface:     #fafafa   卡片/表格背景
--color-border:      #e5e7eb   边框/分隔线
--color-nav:         #1a2744   侧边导航栏背景（深藏蓝）
--color-primary:     #1a2744   主按钮/强调色
--color-primary-light: #eef2f8 浅强调背景（引用标签）
--color-text:        #374151   正文文字
--color-text-secondary: #6b7280 次要文字/标签
--color-success:     #059669   成功状态（已入库）
--color-link:        #2c5282   链接/引用
```

### 字体

```
--font-heading: Georgia, 'Times New Roman', serif   # 页面标题、卡片标题
--font-body:    system-ui, -apple-system, sans-serif  # 正文、UI 元素
--font-mono:    'Courier New', monospace              # 数据、化学式
```

### 尺寸 & 间距

```
--nav-width:      72px     # 侧边导航栏宽度
--content-padding: 24px   # 内容区 padding
--card-radius:     8px     # 卡片圆角
--bubble-radius:   12px    # 聊天气泡圆角
--input-radius:    10px    # 输入框圆角
```

### 侧边栏样式

- 背景色：#1a2744（深藏蓝）
- 导航项尺寸：52×52px + 上下文字标签
- 激活项：白色半透明背景(#ffffff20)，文字白色
- 未激活项：opacity 0.5，文字 #8fa4c0
- 圆角 8px

## 数据流

所有 API 调用复用现有的 `frontend/src/lib/api.ts` 模块。路由切换通过 Next.js `<Link>` 或 `useRouter` 实现客户端导航，不触发全页刷新。

**关键变化：**
- `page.tsx` 中的 `fetchPapers`、`uploadPDF` 等逻辑需要迁移到各自的页面组件
- `useChat` hook 保留在聊天页面使用
- `AnalyticsPanel`、`DataMiningPanel`、`EntityBrowser`、`VizPanel` 作为独立组件被各页面引用
- 全局状态（如 papers 列表）如果跨页面共享，可用 React Context 或每页面独立请求

## 技术约束

- 保持 Next.js 14 App Router（不升级）
- 保持 Tailwind CSS 3.4 + shadcn/ui 组件
- 保持 ECharts 图表库
- 保持暗色模式兼容（可选，后续扩展）
- 不修改后端 API
