# ClawView — 系统架构与技术选型白皮书

> **文档版本**: v1.0.0
> **角色**: 本文档是整个 ClawView 项目的技术宪法，所有技术决策必须与本文档对齐。

---

## 1. 架构总纲

ClawView 是 OpenClaw AI Agent 的**移动端透明控制层**。它不修改、不 fork OpenClaw，而是以**旁路采集 → 事件标准化 → 叙事翻译 → 实时推送 → 人类干预回传**的链路，将工程级日志转化为普通用户可理解的控制界面。

### 1.1 架构约束（不可违反）

| # | 约束 | 原因 |
|---|------|------|
| C-1 | **零侵入原则** — 不 fork、不 patch OpenClaw 内核 | 保证与官方版本的持续兼容性 |
| C-2 | **移动优先 / PWA 优先** — 所有交互先为 375px 宽度设计 | PRD 核心定位：手机端即开即用 |
| C-3 | **实时性 SLA ≤ 3s** — 从 OpenClaw 事件产生到用户屏幕刷新 | "看见 AI 工作"体验的最低门槛 |
| C-4 | **数据最小化** — 只采集展示所需数据，不做全量镜像 | 隐私合规 + 存储成本控制 |
| C-5 | **零信任安全模型** — 每个请求都必须验证身份和权限 | 高危审批场景的安全基线 |

---

## 2. 技术选型（Tech Stack）

### 2.1 总览

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile PWA (React)                    │
│            Vite · Zustand · TanStack Query              │
│              Tailwind CSS · shadcn/ui                    │
├─────────────────────────────────────────────────────────┤
│                     BFF API (Hono)                       │
│          SSE/WebSocket · Zod · Drizzle ORM              │
├─────────────────────────────────────────────────────────┤
│                  Data Layer (SQLite)                     │
│        Turso (prod) · better-sqlite3 (dev/local)        │
├─────────────────────────────────────────────────────────┤
│              OpenClaw Integration Layer                  │
│      File Watcher · CLI Bridge · Webhook Receiver       │
└─────────────────────────────────────────────────────────┘
```

### 2.2 前端 — 移动 PWA

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **React** | 19+ | 生态成熟，Concurrent Features 提升实时 UI 流畅度；社区组件可复用 |
| **Vite** | 6+ | 亚秒级 HMR，天然支持 PWA 插件（`vite-plugin-pwa`），构建产物极小 |
| **Tailwind CSS** | 4+ | 原子化 CSS 杜绝样式冲突，移动端响应式开发效率最高 |
| **shadcn/ui** | latest | 非黑盒组件库——源码直接拷入项目、可深度定制，无运行时依赖膨胀 |
| **Zustand** | 5+ | ~1KB，无 Provider 嵌套地狱，天然适配实时数据流（WebSocket 推入 store） |
| **TanStack Query** | 5+ | 服务端状态缓存、后台刷新、离线支持；与 Zustand 分治客户端/服务端状态 |
| **Framer Motion** | 12+ | 状态灯呼吸动画、步骤流展开等微交互，GPU 加速 |
| **vite-plugin-pwa** | latest | Service Worker 注册、离线缓存、可安装性——满足 PWA 硬性要求 |

**为什么不用 Next.js？**
ClawView 本质是实时仪表盘 SPA，不需要 SEO 和 SSR。Next.js 的服务端渲染机制会增加部署复杂度（需要 Node 服务器），违背"轻量"原则。Vite SPA + 静态部署（Cloudflare Pages / Vercel Static）是最简路径。

**为什么不用 Vue / Svelte？**
OpenClaw 社区和中国 AI 开发者圈层 React 生态渗透率最高，招聘和社区贡献者匹配度最优。

### 2.3 BFF / API 层

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **Hono** | 4+ | ~14KB 极致轻量；TypeScript-first；可部署在 Node/Bun/Cloudflare Workers/Deno，保留未来 Edge 部署能力 |
| **Zod** | 3+ | 运行时 schema 校验 + TypeScript 类型推导一体化；前后端共享 validator |
| **Drizzle ORM** | latest | Type-safe SQL，零运行时抽象，迁移工具完善；与 SQLite/Turso 原生兼容 |
| **hono/ws** | built-in | Hono 内置 WebSocket 升级，无需额外依赖 |

**为什么不用 Express / Fastify / NestJS？**
- Express：无 TypeScript-first 设计，中间件模型老旧。
- Fastify：优秀但体积 > Hono 5x，且无 Edge Runtime 支持。
- NestJS：装饰器 + 依赖注入过重，违背"轻量 BFF"定位——ClawView 的 BFF 不应该是企业级后端框架。

### 2.4 数据持久化

| 技术 | 场景 | 选型理由 |
|------|------|----------|
| **SQLite** (better-sqlite3) | 本地开发 / 单机部署 | 零运维、嵌入式、性能充足（MVP 阶段数据量 < 100K rows/月） |
| **Turso** (libSQL) | 生产环境 | SQLite 协议兼容的边缘数据库；全球复制、嵌入式副本、Serverless 定价；无需运维 Postgres |
| **Redis** (可选, V2+) | 实时 Pub/Sub、会话缓存 | 当 WebSocket 实例 > 1 时，Redis 作为跨进程消息总线；MVP 阶段用内存 EventEmitter 替代 |

**为什么不用 PostgreSQL / MySQL？**
MVP 阶段的数据模型简单（事件流 + 用户配置 + 审批记录），不需要复杂 JOIN 或高并发写入。SQLite/Turso 的单节点写入 + 多边缘读取完美匹配"移动端读多写少"的访问模式，且运维成本为零。

### 2.5 OpenClaw 集成层

| 适配器 | 数据源 | 采集方式 |
|--------|--------|----------|
| **FileWatcher** | transcript 文件、MEMORY.md、memory/*.md | `chokidar` 监听文件变更事件 |
| **CLIBridge** | `openclaw status`、`gateway status`、`/usage` | 定时轮询 CLI 输出（间隔可配，默认 5s） |
| **WebhookReceiver** | `tool_result_persist` hook | HTTP POST 接收，Hono route handler |
| **GatewayProbe** | `channels status --probe` | 心跳探测，判断 Gateway/设备在线状态 |

---

## 3. 数据流（Data Flow）

### 3.1 完整链路图

```
                         OpenClaw Runtime
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              [Transcript] [CLI/Status] [Hooks]
              [Memory Files]            [tool_result]
                    │          │          │
                    ▼          ▼          ▼
              ┌─────────────────────────────────┐
              │     OpenClaw Runtime Adapter     │
              │  FileWatcher│CLIBridge│Webhook   │
              └──────────────┬──────────────────┘
                             │ Raw Events
                             ▼
              ┌─────────────────────────────────┐
              │        Event Collector          │
              │  标准化为 ClawEvent 结构体       │
              │  task_id / session_id / step /   │
              │  tool / model / tokens / status  │
              └──────────┬──────────────────────┘
                         │
                    ┌────┴────┐
                    ▼         ▼
              ┌──────────┐  ┌───────────────────┐
              │ Event DB │  │  Realtime Bus      │
              │ (SQLite) │  │  (EventEmitter /   │
              │ 持久化存储 │  │   Redis Pub/Sub)  │
              └──────────┘  └────────┬──────────┘
                                     │
                                     ▼
              ┌─────────────────────────────────┐
              │       Narrative Engine           │
              │  技术事件 → 人类可读步骤          │
              │  "tool_call:web_search" →         │
              │  "正在搜索相关网页资料"            │
              └──────────────┬──────────────────┘
                             │ Translated Events
                             ▼
              ┌─────────────────────────────────┐
              │         BFF API (Hono)          │
              │  REST endpoints + SSE/WS push   │
              └──────────┬──────────────────────┘
                         │ SSE / WebSocket
                         ▼
              ┌─────────────────────────────────┐
              │       Mobile PWA (React)        │
              │  状态灯│步骤流│成本│记忆│告警     │
              └──────────┬──────────────────────┘
                         │ User Action (Approve/Deny)
                         ▼
              ┌─────────────────────────────────┐
              │       Approval Flow             │
              │  PWA → BFF → OpenClaw Gateway   │
              │  (指令回传 / 进程终止)           │
              └─────────────────────────────────┘
```

### 3.2 数据流阶段详解

#### Phase 1: 旁路采集 (Side-Channel Collection)

OpenClaw Runtime Adapter **只读**监听以下数据源：

| 数据源 | 触发方式 | 产出 |
|--------|----------|------|
| `~/.openclaw/sessions/*/transcript.jsonl` | 文件 append 事件 | 新的 tool_call / assistant_message / user_message |
| `MEMORY.md` / `memory/*.md` | 文件变更事件 | 记忆新增 / 修改 / 删除 diff |
| `openclaw status` CLI | 定时轮询 (5s) | 设备在线状态、Gateway 连接状态 |
| `/usage` 命令输出 | 定时轮询 (30s) | token 消耗、模型分布、费用 |
| `tool_result_persist` webhook | HTTP POST 推送 | 工具执行结果 |

#### Phase 2: 事件标准化 (Event Normalization)

所有原始数据统一转化为 `ClawEvent` 结构：

```typescript
interface ClawEvent {
  id: string;                    // ULID，天然有序
  taskId: string;                // 任务维度聚合 key
  sessionId: string;             // OpenClaw session ID
  type: ClawEventType;           // 枚举：status_change | step | cost_update | memory_change | alert | approval_request
  timestamp: number;             // Unix ms
  payload: Record<string, unknown>;  // 类型由 type 决定，Zod discriminated union 校验
  source: 'file_watcher' | 'cli_bridge' | 'webhook';
}
```

#### Phase 3: 叙事翻译 (Narrative Translation)

Narrative Engine 是 ClawView 的核心差异化层。它将工程事件翻译为用户语言：

| 原始事件 | 翻译结果 |
|----------|----------|
| `tool_call: web_search, query: "公司融资新闻"` | 🔍 正在搜索"公司融资新闻"相关网页 |
| `tool_call: file_read, path: "/data/clients.csv"` | 📄 正在读取客户数据文件 |
| `model_switch: gpt-4o → gpt-4o-mini` | ⚡ 已切换到更快的模型处理简单子任务 |
| `error: rate_limit_exceeded` | ⚠️ 模型接口暂时拥堵，正在等待重试 |
| `memory_write: "用户偏好早上 9 点开会"` | 🧠 记住了：你偏好早上 9 点开会 |

翻译规则以**配置文件驱动**（`narrative-rules.yaml`），支持热更新，不硬编码在业务逻辑中。

#### Phase 4: 实时推送 (Realtime Push)

| 机制 | 适用场景 | 降级方案 |
|------|----------|----------|
| **SSE (Server-Sent Events)** | 主推送通道——单向推送、自动重连、穿透代理 | 无需降级，SSE 是默认 |
| **WebSocket** | 双向通信场景——审批交互、实时指令 | SSE + REST POST 混合 |
| **轮询 (Long Polling)** | 极端网络环境降级 | TanStack Query refetchInterval |

**为什么 SSE 优先于 WebSocket？**
移动网络下 SSE 更稳定（HTTP/2 复用、自动重连、CDN 穿透）。绝大多数数据流是服务端→客户端单向推送。仅在审批交互等双向场景启用 WebSocket。

#### Phase 5: 人类干预回传 (Human-in-the-Loop)

当 OpenClaw 执行高危操作时：

```
OpenClaw 触发高危动作
       │
       ▼
Adapter 检测到 approval_required 事件
       │
       ▼
BFF 生成 ApprovalRequest，推送至用户 PWA
       │
       ▼
用户看到审批卡片：操作描述 + 风险等级 + Approve/Deny
       │
       ├── Approve → BFF 向 OpenClaw Gateway 发送继续执行指令
       │
       └── Deny → BFF 向 OpenClaw Gateway 发送终止指令
                  同时记录审计日志
```

高危动作判定规则（可配置）：
- 单次费用超过阈值（默认 ¥5）
- 文件删除操作
- 发送外部消息（邮件、IM）
- 访问敏感目录
- 执行系统命令

---

## 4. 安全架构（Zero-Trust Security Model）

### 4.1 核心原则

**"Never trust, always verify"** — 不信任任何网络位置、设备或身份，每次访问都独立验证。

### 4.2 认证与鉴权

```
┌────────────────────────────────────────────┐
│              Authentication Flow            │
│                                            │
│  PWA ──login──▶ BFF ──verify──▶ Auth Store │
│       ◀─JWT+RT─┘                           │
│                                            │
│  后续请求:                                  │
│  PWA ──Bearer JWT──▶ BFF Middleware        │
│       verify signature + expiry + claims    │
│       check device fingerprint              │
│       enforce RBAC                          │
└────────────────────────────────────────────┘
```

| 层级 | 机制 | 细节 |
|------|------|------|
| **身份认证** | JWT (Access Token) + Refresh Token | Access Token 有效期 15min，Refresh Token 7d；Refresh Token rotation |
| **设备绑定** | Device Fingerprint | 首次登录生成设备指纹，异常设备触发二次验证 |
| **审批二次确认** | PIN / Biometric (WebAuthn) | 高危审批操作（Approve/Deny）需要二次验证 |
| **权限模型** | RBAC | 角色：`owner` / `admin` / `viewer`；资源：agent、task、memory |
| **传输安全** | TLS 1.3 强制 | HSTS header，禁止 HTTP 降级 |

### 4.3 敏感数据脱敏规则

这是 ClawView 的**安全红线**，所有开发者必须遵守：

| 数据类型 | 脱敏规则 | 示例 |
|----------|----------|------|
| API Key | 仅展示前缀 + 后 4 位 | `sk-proj-...a1b2` |
| Token / Secret | 完全不存储、不传输、不展示 | `[REDACTED]` |
| 用户密码 | bcrypt/argon2 单向哈希，从不明文 | — |
| 文件路径中的用户名 | 替换为占位符 | `/Users/[USER]/...` |
| 聊天内容中的手机号 | 正则匹配后部分遮罩 | `138****5678` |
| 聊天内容中的邮箱 | 用户名部分遮罩 | `z***@gmail.com` |
| OpenClaw Gateway 凭证 | 从不经过 ClawView 前端 | 仅存服务端，AES-256 加密 |

**执行层面**：BFF 层设置统一的 `SanitizationMiddleware`，所有出站响应必须经过脱敏 pipeline，前端不依赖"后端已经脱敏"的假设——前端也需设置兜底脱敏工具函数。

### 4.4 安全 Headers

BFF 所有响应必须包含：

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; connect-src 'self' wss://*.clawview.app; img-src 'self' data:; style-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 4.5 API 安全

| 措施 | 实现 |
|------|------|
| **Rate Limiting** | IP 级 100 req/min，用户级 300 req/min |
| **Request Size** | Body ≤ 1MB |
| **CORS** | 白名单域名，禁止 `*` |
| **Input Validation** | 所有入参经 Zod schema 校验，拒绝未知字段 |
| **SQL Injection** | Drizzle ORM 参数化查询，禁止原始 SQL 拼接 |
| **XSS** | React 默认转义 + CSP；Narrative Engine 输出必须纯文本 |

### 4.6 审计日志

所有以下操作产生不可变审计记录：
- 用户登录 / 登出
- 审批操作 (Approve / Deny)
- 记忆删除 / 修改
- 配置变更（预算阈值、告警规则）
- 异常告警触发

审计日志格式：

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  detail: Record<string, unknown>;
  ip: string;
  deviceFingerprint: string;
  timestamp: number;
}
```

---

## 5. 部署架构

### 5.1 MVP 部署（单机 / 低成本）

```
┌─────────────────────────────────────────┐
│  用户手机浏览器                          │
│  ←── CDN (Cloudflare Pages) ──→ PWA     │
│  ←── SSE/WS ──→ BFF (Fly.io/Railway)   │
│                   │                     │
│                   ├── SQLite (嵌入式)    │
│                   └── OpenClaw Adapter   │
│                        │                │
│                        ▼                │
│                   OpenClaw Runtime       │
│                   (用户本地设备)         │
└─────────────────────────────────────────┘
```

**关键点**：OpenClaw 运行在用户自己的设备上，ClawView BFF 可以：
- **方案 A (本地部署)**: BFF 也运行在用户设备上，直接读取本地文件——最简单，MVP 首选。
- **方案 B (远程部署)**: BFF 运行在云端，通过用户设备上的轻量 Agent 转发事件——适合多设备同步。

### 5.2 生产部署（V2+）

```
用户设备                    云端
┌──────────┐         ┌──────────────────┐
│ OpenClaw │ ──WS──▶ │ BFF Cluster      │
│ + Relay  │         │ (Fly.io/K8s)     │
│  Agent   │         │  ├── Hono × N    │
└──────────┘         │  ├── Turso (DB)  │
                     │  └── Redis (PubSub)│
                     └────────┬─────────┘
                              │ SSE
                              ▼
                     ┌──────────────────┐
                     │  CDN (Static)    │
                     │  PWA Assets      │
                     └──────────────────┘
```

---

## 6. 可观测性 (Observability)

| 维度 | 工具 | 用途 |
|------|------|------|
| **日志** | Pino (结构化 JSON) | BFF 请求日志、Adapter 采集日志 |
| **指标** | Prometheus 兼容 metrics | 事件吞吐量、SSE 连接数、API 延迟 P99 |
| **错误追踪** | Sentry | 前端 JS 异常、BFF 未捕获错误 |
| **健康检查** | `/healthz` + `/readyz` | 部署探针、外部监控 |

---

## 7. 技术决策记录 (ADR Index)

后续所有重要技术决策以 ADR (Architecture Decision Record) 形式归档于 `docs/adr/` 目录：

| ADR | 标题 | 状态 |
|-----|------|------|
| ADR-001 | 选择 React + Vite 作为前端方案 | Accepted |
| ADR-002 | 选择 Hono 作为 BFF 框架 | Accepted |
| ADR-003 | 选择 SQLite/Turso 作为主数据库 | Accepted |
| ADR-004 | SSE 优先于 WebSocket 的实时推送策略 | Accepted |
| ADR-005 | 事件采集使用旁路监听而非 OpenClaw 内核修改 | Accepted |
