# 用户认证 + 对话存储 — 设计文档

## 概述

为 Literature Agent 添加用户认证系统（注册/登录/JWT）和对话记录后端存储。所有聊天功能必须登录后使用，对话记录与用户账号绑定，存储在 PostgreSQL 中。

**目标：**
- 用户名 + 密码注册/登录，JWT token 24 小时过期
- 未登录用户重定向到登录页，无法使用聊天功能
- 对话历史迁移到后端数据库，换端口/换设备可恢复
- 会话管理：新建、切换、删除对话
- 现有文献库、分析、实体页面保持可用（只读）

**技术栈：** FastAPI + SQLAlchemy Async + PostgreSQL，Next.js 14 App Router，JWT (PyJWT) + bcrypt

## 架构

### 数据库新增表

```
users
├── id: UUID (PK, 自动生成)
├── username: VARCHAR(64), unique, not null
├── password_hash: VARCHAR(256), not null
└── created_at: DateTime (UTC)

conversations
├── id: UUID (PK, 自动生成)
├── user_id: UUID (FK → users.id, CASCADE)
├── title: VARCHAR(256), default="新对话"
├── created_at: DateTime (UTC)
└── updated_at: DateTime (UTC, onupdate)

messages
├── id: UUID (PK, 自动生成)
├── conversation_id: UUID (FK → conversations.id, CASCADE)
├── role: VARCHAR(16), not null — "user" | "assistant"
├── content: Text, not null
├── citations: JSON, nullable
└── created_at: DateTime (UTC)
```

### 后端新增模块

```
backend/
├── services/auth.py          # 密码哈希(bcrypt)、JWT 签发/验证、get_current_user 依赖
├── routes/auth.py            # POST /api/auth/register, /api/auth/login, GET /api/auth/me
├── routes/conversations.py   # CRUD 对话和消息
└── requirements.txt 新增     # pyjwt, bcrypt
```

### API 端点

```
# 认证（无需鉴权）
POST /api/auth/register  { username, password }             → { user_id, token }
POST /api/auth/login     { username, password }             → { user_id, token }

# 用户信息（需要鉴权）
GET  /api/auth/me        Header: Authorization Bearer <token> → { user_id, username }

# 对话列表（需要鉴权）
GET    /api/conversations                                  → [{ id, title, created_at, updated_at }]
POST   /api/conversations            { title }              → { id, title, created_at }
DELETE /api/conversations/{id}                              → { deleted: id }

# 对话消息（需要鉴权）
GET    /api/conversations/{id}/messages                     → [{ id, role, content, citations, created_at }]
POST   /api/conversations/{id}/messages  { query }          → SSE stream (替代原 /api/chat)
```

**认证方式：** 所有需要鉴权的端点使用 `Authorization: Bearer <token>` 头。token 由 JWT 签发，payload 包含 `{ user_id, username, exp }`，24 小时过期。

**旧 `/api/chat` 兼容：** 保留旧端点，但改为需要鉴权。未登录返回 401。

### 前端新增/修改

```
frontend/src/
├── contexts/
│   └── auth.tsx              # AuthProvider: token 管理、登录/注册/退出、当前用户状态
├── app/
│   ├── login/
│   │   └── page.tsx          # 登录页（用户名 + 密码）
│   ├── register/
│   │   └── page.tsx          # 注册页（用户名 + 密码 + 确认密码）
│   └── layout.tsx            # 根布局：AuthProvider 包裹
├── hooks/
│   └── use-chat.ts           # 重写：从 localStorage → 后端 API
└── components/
    └── chat/
        └── chat-panel.tsx    # 新增会话列表侧栏
```

### 前端路由

| 路径 | 页面 | 鉴权 |
|------|------|------|
| `/login` | 登录页 | 不需要 |
| `/register` | 注册页 | 不需要 |
| `/` | 聊天（首页） | 需要 |
| `/library` | 文献库 | 需要 |
| `/analytics` | 分析 | 需要 |
| `/entities` | 实体 | 需要 |

**路由守卫：** 未登录用户访问任何需要鉴权的页面 → 重定向到 `/login`。已登录用户访问 `/login` 或 `/register` → 重定向到 `/`。

### Auth Context

```typescript
interface AuthContext {
  user: { user_id: string; username: string } | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
```

- `token` 存储在 `localStorage` key=`literature_agent_token`
- `login`/`register` 成功后设置 token 和 user，重定向到 `/`
- `logout` 清除 token 和 user，重定向到 `/login`
- 应用初始化时自动从 token 加载用户信息（`GET /api/auth/me`）

### 对话数据流（新版）

```
1. 用户登录 → 获取 token，存入 localStorage
2. 用户进入首页 → GET /api/conversations → 显示会话列表
3. 用户选择/新建会话 → GET /api/conversations/{id}/messages → 加载历史消息
4. 用户发送消息 → POST /api/conversations/{id}/messages → SSE 流式接收回复
   - 后端保存 user 消息和 AI 回复到数据库
   - 前端实时展示流式内容
5. 用户切换/删除会话 → 对应 API 调用
```

### 登录/注册页设计

遵循现有学术期刊风格：纯白底色、深藏蓝强调、Georgia 衬线标题。

**登录页布局：**
- 居中卡片，左侧项目 Logo 和简介，右侧表单
- 表单：用户名输入框 + 密码输入框 + 登录按钮 + 注册链接

**注册页布局：**
- 同登录页风格
- 表单：用户名输入框 + 密码输入框 + 确认密码输入框 + 注册按钮 + 登录链接

### ChatPanel 会话侧栏

在现有的聊天界面基础上，新增左侧会话列表：

```
┌──────────────────┐  ┌─────────────────────┐  ┌───────────┐
│  SideNav (72px)  │  │  Conversation List   │  │  Chat     │
│   💬 聊天         │  │  ├ 新建对话          │  │  Messages  │
│   📚 文献库       │  │  ├ 对话1（激活）     │  │           │
│   📊 分析         │  │  ├ 对话2             │  │  Input    │
│   🔬 实体         │  │  └ 对话3             │  │           │
└──────────────────┘  └─────────────────────┘  └───────────┘
   72px                  200px                    flex-1
```

## 安全措施

- 密码使用 bcrypt 哈希（cost=12），明文永不入库
- JWT secret 从环境变量 `JWT_SECRET` 读取，默认值仅用于开发
- token 24 小时过期（`exp` claim）
- 密码最小长度：6 字符
- 用户名：3-32 字符，仅允许字母数字和下划线

## 技术约束

- 不修改现有 7 张业务表
- 不修改现有上传/分析/实体 API
- 保持 Next.js 14 App Router
- 保持 Tailwind CSS + shadcn/ui
- 保持 Docker Compose 部署方式
