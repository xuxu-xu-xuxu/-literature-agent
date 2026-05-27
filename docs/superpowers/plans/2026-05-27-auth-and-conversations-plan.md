# 用户认证 + 对话存储 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加用户名+密码认证系统和对话记录的后端数据库存储，所有聊天功能需登录后使用。

**Architecture:** 新增 users/conversations/messages 三张 PostgreSQL 表，auth service 提供 bcrypt 密码哈希和 JWT 鉴权，前端 AuthContext 管理登录状态，会话列表和消息通过 REST/SSE API 存取。

**Tech Stack:** FastAPI, SQLAlchemy Async, PyJWT, bcrypt, Next.js 14 App Router, React Context

---

### Task 1: 新增依赖包

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: 添加 pyjwt 和 bcrypt**

在 `backend/requirements.txt` 末尾追加两行：

```
pyjwt==2.10.1
bcrypt==4.3.0
```

- [ ] **Step 2: 提交**

```bash
git add backend/requirements.txt
git commit -m "deps: add pyjwt and bcrypt for authentication"
```

---

### Task 2: 新增数据库模型（User, Conversation, Message）

**Files:**
- Modify: `backend/models/database.py`
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 在 database.py 中添加三张新表**

在 `backend/models/database.py` 文件末尾的 `SolidElectrolyteRecord` 类之后追加：

```python
import uuid


def _new_uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_new_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(256), default="新对话")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: 在 schemas.py 中添加请求模型**

在 `backend/models/schemas.py` 末尾追加：

```python
class AuthRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)

class ConversationCreate(BaseModel):
    title: str = Field(default="新对话", max_length=256)

class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: int
    conversation_id: str
    role: str
    content: str
    citations: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 3: 提交**

```bash
git add backend/models/database.py backend/models/schemas.py
git commit -m "feat: add User, Conversation, Message database models"
```

---

### Task 3: 创建认证服务（bcrypt + JWT）

**Files:**
- Create: `backend/services/auth.py`

- [ ] **Step 1: 创建 auth.py**

创建 `backend/services/auth.py`：

```python
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select

from backend.models.database import User, get_db

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_token(user_id: str, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的 Token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token 无效")

    async for db in get_db():
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        return user
```

- [ ] **Step 2: 提交**

```bash
git add backend/services/auth.py
git commit -m "feat: add auth service with bcrypt hashing and JWT token management"
```

---

### Task 4: 创建认证路由（register / login / me）

**Files:**
- Create: `backend/routes/auth.py`

- [ ] **Step 1: 创建 auth.py 路由**

创建 `backend/routes/auth.py`：

```python
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select

from backend.models.database import User, get_db
from backend.models.schemas import AuthRequest
from backend.services.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(request: AuthRequest):
    async for db in get_db():
        result = await db.execute(select(User).where(User.username == request.username))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="用户名已存在")
        user = User(username=request.username, password_hash=hash_password(request.password))
        db.add(user)
        await db.commit()
        token = create_token(user.id, user.username)
        return {"user_id": user.id, "username": user.username, "token": token}


@router.post("/login")
async def login(request: AuthRequest):
    async for db in get_db():
        result = await db.execute(select(User).where(User.username == request.username))
        user = result.scalar_one_or_none()
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        token = create_token(user.id, user.username)
        return {"user_id": user.id, "username": user.username, "token": token}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user_id": user.id, "username": user.username}
```

- [ ] **Step 2: 在 main.py 注册路由**

在 `backend/main.py` 中添加 import 和 router 注册：

在 import 区域末尾添加：
```python
from backend.routes.auth import router as auth_router
```

在 `app.include_router` 区域末尾添加：
```python
app.include_router(auth_router)
```

- [ ] **Step 3: 提交**

```bash
git add backend/routes/auth.py backend/main.py
git commit -m "feat: add auth routes — register, login, me"
```

---

### Task 5: 创建对话路由（CRUD + SSE 消息流）

**Files:**
- Create: `backend/routes/conversations.py`

- [ ] **Step 1: 创建 conversations.py 路由**

创建 `backend/routes/conversations.py`：

```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models.database import User, Conversation, Message, get_db
from backend.models.schemas import ConversationCreate, ConversationOut, MessageOut
from backend.services.auth import get_current_user
from backend.services.rag_service import generate_answer_stream

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(user: User = Depends(get_current_user)):
    async for db in get_db():
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.updated_at.desc())
        )
        convos = result.scalars().all()
        return [ConversationOut.model_validate(c) for c in convos]


@router.post("")
async def create_conversation(request: ConversationCreate, user: User = Depends(get_current_user)):
    async for db in get_db():
        convo = Conversation(user_id=user.id, title=request.title)
        db.add(convo)
        await db.commit()
        return ConversationOut.model_validate(convo)


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, user: User = Depends(get_current_user)):
    async for db in get_db():
        convo = await db.get(Conversation, conversation_id)
        if not convo or convo.user_id != user.id:
            raise HTTPException(status_code=404, detail="对话不存在")
        await db.delete(convo)
        await db.commit()
        return {"deleted": conversation_id}


@router.get("/{conversation_id}/messages")
async def list_messages(conversation_id: str, user: User = Depends(get_current_user)):
    async for db in get_db():
        convo = await db.get(Conversation, conversation_id)
        if not convo or convo.user_id != user.id:
            raise HTTPException(status_code=404, detail="对话不存在")
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        messages = result.scalars().all()
        return [MessageOut.model_validate(m) for m in messages]


@router.post("/{conversation_id}/messages")
async def send_message(conversation_id: str, body: dict, user: User = Depends(get_current_user)):
    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="消息内容不能为空")

    async for db in get_db():
        convo = await db.get(Conversation, conversation_id)
        if not convo or convo.user_id != user.id:
            raise HTTPException(status_code=404, detail="对话不存在")

        # Save user message
        db.add(Message(conversation_id=conversation_id, role="user", content=query))
        # Update conversation title from first message
        if convo.title == "新对话":
            convo.title = query[:60] + ("..." if len(query) > 60 else "")
        await db.commit()
        break

    async def event_stream():
        full_response = ""
        citations = None
        try:
            async for chunk in generate_answer_stream(query):
                if chunk:
                    full_response += chunk
                    data = chunk.replace("\n", "\ndata: ")
                    yield f"data: {data}\n\n"
        except Exception as exc:
            yield f"data: [回答出错：{exc}]\n\n"

        # Save AI response
        async for db in get_db():
            db.add(Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_response,
                citations=citations,
            ))
            await db.commit()
            break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
```

- [ ] **Step 2: 在 main.py 注册路由**

在 `backend/main.py` 的 import 区域添加：
```python
from backend.routes.conversations import router as conversations_router
```

在 `app.include_router` 区域添加：
```python
app.include_router(conversations_router)
```

- [ ] **Step 3: 提交**

```bash
git add backend/routes/conversations.py backend/main.py
git commit -m "feat: add conversation routes — CRUD + streaming SSE messages"
```

---

### Task 6: 添加 JWT_SECRET 配置

**Files:**
- Modify: `.env`
- Modify: `docker-compose.yml`

- [ ] **Step 1: 在 .env 添加 JWT_SECRET**

在 `.env` 末尾添加：

```
JWT_SECRET=change-this-to-a-random-secret-in-production
```

- [ ] **Step 2: 在 docker-compose.yml 后端服务注入环境变量**

在 `docker-compose.yml` 的 `backend` 服务 `environment` 区域添加：

```yaml
- JWT_SECRET=${JWT_SECRET:-dev-secret-change-in-production}
```

- [ ] **Step 3: 提交**

```bash
git add .env docker-compose.yml
git commit -m "config: add JWT_SECRET to env and docker-compose"
```

---

### Task 7: 创建前端 Auth Context

**Files:**
- Create: `frontend/src/contexts/auth.tsx`

- [ ] **Step 1: 创建 AuthProvider**

创建 `frontend/src/contexts/auth.tsx`：

```tsx
"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
  user_id: string;
  username: string;
}

interface AuthContext {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthContext | null>(null);
const TOKEN_KEY = "literature_agent_token";

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Restore session on mount
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setTokenState(stored);
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${stored}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setUser({ user_id: data.user_id, username: data.username });
          else { setToken(null); setTokenState(null); }
        })
        .catch(() => { setToken(null); setTokenState(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || "登录失败");
    }
    const data = await resp.json();
    setToken(data.token);
    setTokenState(data.token);
    setUser({ user_id: data.user_id, username: data.username });
    router.push("/");
  }, [router]);

  const register = useCallback(async (username: string, password: string) => {
    const resp = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || "注册失败");
    }
    const data = await resp.json();
    setToken(data.token);
    setTokenState(data.token);
    setUser({ user_id: data.user_id, username: data.username });
    router.push("/");
  }, [router]);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/contexts/auth.tsx
git commit -m "feat: add AuthProvider context with login, register, logout"
```

---

### Task 8: 创建登录页和注册页

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`

- [ ] **Step 1: 创建登录页**

创建 `frontend/src/app/login/page.tsx`：

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { BookOpen } from "lucide-react";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) { router.push("/"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BookOpen className="w-10 h-10 text-[#1a2744] mx-auto mb-3" />
          <h1 className="text-xl font-heading text-[#1a2744]">Literature Agent</h1>
          <p className="text-sm text-gray-500 mt-1">材料科学文献智能助手</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              required
              className="w-full px-4 py-2.5 border border-[#d1d5db] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
              className="w-full px-4 py-2.5 border border-[#d1d5db] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1a2744] text-white rounded-lg text-sm font-medium hover:bg-[#2d3f5e] disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          还没有账号？<Link href="/register" className="text-[#2c5282] hover:underline">注册</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建注册页**

创建 `frontend/src/app/register/page.tsx`：

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { BookOpen } from "lucide-react";

export default function RegisterPage() {
  const { register, user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) { router.push("/"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPwd) {
      setError("两次输入的密码不一致");
      return;
    }
    if (username.length < 3) {
      setError("用户名至少 3 个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 个字符");
      return;
    }
    setLoading(true);
    try {
      await register(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BookOpen className="w-10 h-10 text-[#1a2744] mx-auto mb-3" />
          <h1 className="text-xl font-heading text-[#1a2744]">创建账号</h1>
          <p className="text-sm text-gray-500 mt-1">注册后即可使用文献助手</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名（3-32位）"
              required
              className="w-full px-4 py-2.5 border border-[#d1d5db] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少6位）"
              required
              className="w-full px-4 py-2.5 border border-[#d1d5db] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="确认密码"
              required
              className="w-full px-4 py-2.5 border border-[#d1d5db] rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1a2744] text-white rounded-lg text-sm font-medium hover:bg-[#2d3f5e] disabled:opacity-50"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          已有账号？<Link href="/login" className="text-[#2c5282] hover:underline">登录</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/app/login/page.tsx frontend/src/app/register/page.tsx
git commit -m "feat: add login and register pages"
```

---

### Task 9: 更新根布局集成 AuthProvider

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: 用 AuthProvider 包裹应用**

将 `frontend/src/app/layout.tsx` 完整替换为：

```tsx
import type { Metadata } from "next";
import { SideNav } from "@/components/side-nav";
import { AuthProvider } from "@/contexts/auth";
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
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideNav />
      <main className="flex-1 min-w-0 overflow-hidden">
        {children}
      </main>
    </>
  );
}
```

> 注意：`AppShell` 必须是一个单独的组件（而非直接在 `AuthProvider` 内部渲染），因为 `SideNav` 使用了 `usePathname()` 依赖于 Next.js 路由上下文，而 `AuthProvider` 也使用了 `useRouter()`。将 `AppShell` 放在 `AuthProvider` 内部可以确保两者都能正常工作。

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat: wrap app with AuthProvider for global auth state"
```

---

### Task 10: 添加路由守卫

**Files:**
- Create: `frontend/src/components/auth-guard.tsx`

- [ ] **Step 1: 创建 AuthGuard 组件**

创建 `frontend/src/components/auth-guard.tsx`：

```tsx
"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) {
      router.push("/login");
    } else if (user && isPublic) {
      router.push("/");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a2744]" />
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: 使用 AuthGuard 包裹各页面**

在 `frontend/src/app/layout.tsx` 的 `AppShell` 中包裹 children：

将 `<main>` 内部改为：
```tsx
import { AuthGuard } from "@/components/auth-guard";

// In AppShell:
<main className="flex-1 min-w-0 overflow-hidden">
  <AuthGuard>{children}</AuthGuard>
</main>
```

> 需更新 `layout.tsx`，在 `AppShell` 内的 `<main>` 中使用 `<AuthGuard>` 包裹 children。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/auth-guard.tsx frontend/src/app/layout.tsx
git commit -m "feat: add AuthGuard — redirect unauthenticated users to login"
```

---

### Task 11: 重写 useChat 从 localStorage 到后端 API

**Files:**
- Modify: `frontend/src/hooks/use-chat.ts`

- [ ] **Step 1: 重写 useChat**

将 `frontend/src/hooks/use-chat.ts` 完整替换为：

```tsx
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/auth";

interface Citation {
  paper_id: string;
  title: string;
  author: string;
  year: number;
  section: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function useChat(conversationId: string | null) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId || !token) {
      setMessages([]);
      return;
    }
    setLoading(true);
    fetch(`/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setMessages(
          (data || []).map((m: { id: number; role: string; content: string; citations?: Citation[] }) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
            citations: m.citations,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId, token]);

  const sendMessage = useCallback(
    async (query: string, scopePaperIds: string[] = []) => {
      if (!conversationId || !token) return;

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: query };
      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        const resp = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query, scope_paper_ids: scopePaperIds }),
        });

        const reader = resp.body?.getReader();
        if (!reader) { setIsStreaming(false); return; }

        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: m.content + parsed.content } : m
                    )
                  );
                } else if (parsed.refs) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, citations: parsed.refs } : m
                    )
                  );
                }
              } catch {
                if (data.length > 0) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: m.content + data } : m
                    )
                  );
                }
              }
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: m.content + "\n[回答出错，请重试]" } : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId, token]
  );

  return { messages, isStreaming, loading, sendMessage };
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/hooks/use-chat.ts
git commit -m "feat: migrate useChat from localStorage to backend API with auth"
```

---

### Task 12: 更新 ChatPanel — 新增会话侧栏

**Files:**
- Modify: `frontend/src/components/chat/chat-panel.tsx`

- [ ] **Step 1: 重写 ChatPanel 增加会话列表**

将 `frontend/src/components/chat/chat-panel.tsx` 完整替换为：

```tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/contexts/auth";

interface Props {
  scopePaperId?: string;
}

export function ChatPanel({ scopePaperId }: Props) {
  const { token } = useAuth();
  const [convoId, setConvoId] = useState<string | null>(null);
  const [convos, setConvos] = useState<{ id: string; title: string }[]>([]);
  const { messages, isStreaming, loading, sendMessage } = useChat(convoId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load conversation list
  const loadConvos = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setConvos(data || []);
      }
    } catch {}
  }, [token]);

  useEffect(() => { loadConvos(); }, [loadConvos]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewConvo = async () => {
    if (!token) return;
    const resp = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: "新对话" }),
    });
    if (resp.ok) {
      const data = await resp.json();
      await loadConvos();
      setConvoId(data.id);
    }
  };

  const handleDeleteConvo = async (id: string) => {
    if (!token) return;
    await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (convoId === id) setConvoId(null);
    loadConvos();
  };

  const handleSend = (query: string) => {
    if (!convoId) {
      // Auto-create conversation on first message
      if (!token) return;
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: "新对话" }),
      })
        .then((r) => r.json())
        .then((data) => {
          setConvoId(data.id);
          loadConvos();
          // sendMessage is called after state update — use a workaround
          setTimeout(() => sendMessage(query, scopePaperId ? [scopePaperId] : []), 100);
        });
      return;
    }
    sendMessage(query, scopePaperId ? [scopePaperId] : []);
  };

  return (
    <div className="h-full flex">
      {/* Conversation sidebar */}
      <div className="w-48 shrink-0 border-r border-[#e5e7eb] bg-[#fafafa] flex flex-col">
        <div className="p-3 border-b border-[#e5e7eb]">
          <button
            onClick={handleNewConvo}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#2d3f5e]"
          >
            <Plus className="w-3.5 h-3.5" />
            新建对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {convos.map((c) => (
            <div
              key={c.id}
              onClick={() => setConvoId(c.id)}
              className={`group flex items-center gap-2 px-2 py-2 rounded text-xs cursor-pointer transition-colors ${
                convoId === c.id
                  ? "bg-[#eef2f8] text-[#1a2744] font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <MessageSquare className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteConvo(c.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {convos.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">暂无对话</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-heading text-[#1a2744] mb-1">材料科学文献助手</p>
              <p className="text-sm text-gray-500">
                {convoId ? "开始提问，基于文献获取专业回答" : "点击「新建对话」开始"}
              </p>
            </div>
          </div>
        ) : (
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
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/chat/chat-panel.tsx
git commit -m "feat: add conversation sidebar to ChatPanel with create/switch/delete"
```

---

### Task 13: 更新聊天页面（移除 scope selector，适配新 ChatPanel）

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: 精简聊天页面**

由于会话侧栏已在 ChatPanel 内部，且 scope selector 暂时简化，将 `frontend/src/app/page.tsx` 完整替换为：

```tsx
"use client";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AuthGuard } from "@/components/auth-guard";

export default function ChatPage() {
  return (
    <AuthGuard>
      <div className="h-full flex">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel />
        </div>
      </div>
    </AuthGuard>
  );
}
```

> 注意：需要先确认 `AuthGuard` 是否应置于 layout 层级还是页面层级。如果 layout 中已使用 `AuthGuard` 包裹 children，则页面组件中不需要再次包裹。但为了自包含，页面中保留 `AuthGuard` 是安全的。

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: simplify chat page for new conversation-based ChatPanel"
```

---

### Task 14: 构建验证和清理

**Files:** 无新文件

- [ ] **Step 1: 验证后端语法**

```bash
python -c "
import ast, sys
for f in ['backend/services/auth.py', 'backend/routes/auth.py', 'backend/routes/conversations.py']:
    ast.parse(open(f, encoding='utf-8').read())
    print(f'{f}: OK')
"
```

Expected: 3 files OK

- [ ] **Step 2: 构建前端**

```bash
cd frontend && npm run build
```

Expected: 编译成功，所有路由生成（/login, /register 新增）

- [ ] **Step 3: 修复构建中出现的问题**

根据构建输出检查：
- TypeScript 类型错误
- 未使用的导入
- 缺失的组件引用

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: build verification and cleanup for auth + conversations"
```
