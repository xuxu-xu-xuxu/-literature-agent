# Literature Agent 系统设计

## 概述

一个面向材料科学文献的智能问答系统。支持中英文学术论文 PDF 的 RAG 问答、动态实体提取（结构化数据挖掘）、一键可视化。网页端采用聊天面板 + 可视化面板 + 文献侧边栏的三栏布局。

**规模**：几千篇论文，本地开发优先。

---

## 1. 系统架构

五个核心服务，通过 FastAPI 网关统一对外：

| 服务 | 职责 | 状态 |
|------|------|------|
| PDF 摄取 | PDF 解析 → 清洗 → 切片 → 生成 embedding | 新建 |
| RAG 问答 | 查询改写 → 混合检索 → 重排序 → LLM 生成 | 新建 |
| 实体提取 | 动态识别材料学实体 → 结构化存储 | 新建 |
| 可视化 | 自然语言 → 数据查询 → ECharts 配置 → 图表 | 新建 |
| 前端 | 聊天 + 可视化面板 + 文献侧边栏 | 新建 |

已有基础设施保持不变：Milvus（向量库）、Elasticsearch（全文检索）、BGE-M3（嵌入服务）。

每个服务有独立目录，通过 FastAPI 路由统一对外。LLM 调用抽象为接口，支持切换 OpenAI / DeepSeek / 本地模型。前端与后端纯 API 通信，支持 SSE 流式输出。

---

## 2. PDF 处理流水线

```
PDF → Grobid(元信息) + Docling/Marker(全文Markdown)
    → 后处理(去参考文献、表格独立提取)
    → ES(全文) + Milvus(切片向量) + PostgreSQL(元信息+表格)
```

**切片策略**：按章节 + 段落边界切分，512 tokens，64 tokens 重叠。每个切片附带标题、作者、年份元信息。

**表格独立处理**：Docling 提取表格 → 结构化存储到 PostgreSQL，作为实体提取和可视化的数据源。

---

## 3. RAG 问答

```
用户提问 → 查询改写(LLM) → 混合检索(Milvus+ES, RRF融合top-20)
        → BGE-Reranker重排序(top-5)
        → LLM生成(SSE流式, 带引用)
```

**来源引用机制（防幻觉）**：
- System prompt 硬约束：每个事实性陈述必须标注来源 `[作者, 年份, §章节]`
- 找不到相关文献时必须明确说"当前文献库中未找到相关信息"
- 回答结尾列出所有引用文献条目
- 前端解析引用标签为可点击链接，点击后侧边栏高亮原文段落

**LLM 选型**：接口抽象，默认 DeepSeek V3（中文好、成本低），支持切换 GPT-4o / Claude。

---

## 4. 动态实体提取

两阶段 LLM 提取：

**阶段 1 — Schema 发现**：LLM 阅读论文，动态识别该论文涉及的实体类型和关系类型，输出 JSON Schema。

**阶段 2 — 实例提取**：根据 Schema，从论文中提取所有实体实例和关系，输出结构化 JSON。

**存储**：PostgreSQL JSONB 统一表 `(paper_id, entity_type, attributes JSONB, source_span)`，无论什么子领域的实体都能存。

**跨论文 Schema 收敛**：定期后台任务通过 LLM 语义聚类发现等价实体类型（如"抗拉强度"="拉伸强度"="tensile strength"），构建同义词映射表。用户可手动审核调整。

---

## 5. 一键可视化

```
用户自然语言 → LLM意图解析(实体+属性+图表类型)
            → PostgreSQL查询
            → LLM组装ECharts配置
            → 前端ECharts渲染
```

支持图表类型：柱状图、散点图、箱线图、折线图、热力图。LLM 自动决定图表类型和配置，用户只需说"我想看..."。不满意可口语调整（"换成散点图"）。

---

## 6. 前端

**技术栈**：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + ECharts + KaTeX

**布局**：三栏式
- 左侧：文献侧边栏（搜索、筛选、文献列表，可收起）
- 中间：对话面板（SSE 流式、引用标签可点击、支持多轮）
- 右侧：分析面板（ECharts 图表 + 结构化数据表格）

**设计风格**：专业学术感 + 现代简洁。Slate 灰调 + 蓝色强调，支持暗色模式，动效克制。大屏三栏 → 中屏两栏 → 小屏单栏。

---

## 7. API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传 PDF |
| GET | `/api/papers` | 文献列表（分页、筛选） |
| GET | `/api/papers/{id}` | 文献详情 + 原文段落 |
| POST | `/api/chat` | 对话（SSE 流式） |
| POST | `/api/extract/{paper_id}` | 触发实体提取 |
| GET | `/api/extract/{paper_id}/status` | 提取任务状态 |
| POST | `/api/visualize` | 自然语言 → 图表 |
| GET | `/api/entities` | 查询结构化实体 |
| DELETE | `/api/papers/{id}` | 删除文献 |

**目录结构**：
```
literature_agent/
├── docker-compose.yml
├── bge-api/                 # 已有
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── routes/              # 路由层
│   ├── services/            # 业务逻辑层 (pdf/rag/extract/viz)
│   ├── llm/                 # LLM 抽象层
│   └── models/              # 数据模型
└── frontend/                # Next.js 前端
```

---

## 8. 关键设计决策

1. **LLM 接口抽象**：支持切换 OpenAI / DeepSeek / 本地模型，不绑定单一供应商
2. **实体提取 Schema-free**：不预先写死实体类型，由 LLM 动态发现，定期聚类收敛
3. **前端分离**：纯 API 通信，原型期可先用 Streamlit 验证，后期替换 React 不影响后端
4. **SSE 流式**：对话和提取进度均通过 SSE 推送，用户体验流畅
5. **引用溯源**：每个 RAG 回答的每个事实都追溯到具体论文段落，杜绝幻觉
