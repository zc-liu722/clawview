# ClawView — 项目目录拓扑与职责边界

> **文档版本**: v1.0.0
> **核心原则**: 每个目录有且仅有一个职责。跨层调用必须经过明确的接口边界。

---

## 1. Monorepo 结构总览

本项目采用 **pnpm workspace monorepo**，共享类型系统，独立构建部署。

```
clawview/
│
├── apps/
│   ├── web/                          # [A] 移动端 PWA 前端
│   └── server/                       # [B] BFF API 服务端
│
├── packages/
│   └── shared/                       # [C] 前后端共享包
│
├── docker/                           # [D] 容器化配置
│
├── docs/                             # [E] 架构文档（本文件所在）
│   ├── ARCHITECTURE.md
│   ├── PROJECT_STRUCTURE.md
│   ├── API_CONTRACT_DRAFT.md
│   ├── AI_CODING_RULES.md
│   └── adr/                          # Architecture Decision Records
│
├── scripts/                          # [F] 工程脚本（CI/CD、数据库迁移等）
│
├── .cursorrules                      # AI 编程助手强制规则（Cursor 自动加载）
├── pnpm-workspace.yaml
├── package.json                      # Root：仅放工程工具（lint, format, husky）
├── tsconfig.base.json                # 基础 TypeScript 配置，各 app 继承
├── biome.json                        # Linter + Formatter 统一配置
└── README.md
```

---

## 2. 前端应用详细结构 `apps/web/`

```
apps/web/
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── icons/                        # PWA 图标（多尺寸）
│   └── sw.js                         # Service Worker（由 vite-plugin-pwa 生成）
│
├── src/
│   ├── app/                          # ① App Shell 层
│   │   ├── App.tsx                   # 根组件：Provider 组装、全局 ErrorBoundary
│   │   ├── router.tsx                # 路由配置（React Router / TanStack Router）
│   │   ├── providers/                # 全局 Context Providers（Theme、Auth、Realtime）
│   │   └── layouts/                  # 页面布局骨架（MobileLayout、DesktopLayout）
│   │
│   ├── components/                   # ② 纯 UI 组件层
│   │   ├── ui/                       # 原子组件（shadcn/ui 导入）
│   │   │   ├── button.tsx            #   Button、Badge、Card、Sheet...
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   └── composed/                 # 组合 UI 组件（由 ui/ 原子组合而成）
│   │       ├── status-badge.tsx      #   状态徽标（纯展示，不含业务逻辑）
│   │       ├── step-card.tsx         #   步骤卡片
│   │       ├── cost-gauge.tsx        #   费用仪表
│   │       └── ...
│   │
│   ├── features/                     # ③ 功能模块层（Feature Modules）
│   │   ├── status/                   # 状态灯功能
│   │   │   ├── components/           #   该功能的专属组件
│   │   │   ├── hooks/                #   该功能的专属 hooks
│   │   │   ├── status.store.ts       #   该功能的 Zustand slice
│   │   │   └── index.ts              #   公开导出（只导出 components 和 hooks）
│   │   │
│   │   ├── task-flow/                # 任务步骤流功能
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── task-flow.store.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── cost/                     # 成本追踪功能
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── cost.store.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── memory/                   # 记忆中心功能
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── memory.store.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── alerts/                   # 异常告警功能
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── alerts.store.ts
│   │   │   └── index.ts
│   │   │
│   │   └── approval/                 # 高危审批功能 (Human-in-the-loop)
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── approval.store.ts
│   │       └── index.ts
│   │
│   ├── hooks/                        # ④ 全局共享 Hooks
│   │   ├── use-realtime.ts           #   SSE/WebSocket 连接管理
│   │   ├── use-auth.ts               #   认证状态
│   │   └── use-responsive.ts         #   响应式断点
│   │
│   ├── services/                     # ⑤ API 客户端层（网络请求的唯一出口）
│   │   ├── api-client.ts             #   HTTP client 封装（fetch + interceptor）
│   │   ├── sse-client.ts             #   SSE 连接管理
│   │   ├── ws-client.ts              #   WebSocket 连接管理
│   │   └── endpoints/                #   按领域分文件的 API 函数
│   │       ├── status.api.ts
│   │       ├── tasks.api.ts
│   │       ├── cost.api.ts
│   │       ├── memory.api.ts
│   │       └── approval.api.ts
│   │
│   ├── stores/                       # ⑥ 全局状态（跨功能共享）
│   │   ├── auth.store.ts             #   认证 & 用户信息
│   │   └── connection.store.ts       #   连接状态（SSE/WS 在线/离线）
│   │
│   ├── lib/                          # ⑦ 纯工具函数（零副作用）
│   │   ├── format.ts                 #   格式化函数（金额、日期、token 数）
│   │   ├── sanitize.ts               #   前端脱敏兜底
│   │   ├── constants.ts              #   前端常量
│   │   └── cn.ts                     #   Tailwind class merge 工具
│   │
│   └── types/                        # ⑧ 前端专属类型（非领域模型）
│       ├── router.ts                 #   路由参数类型
│       └── env.d.ts                  #   环境变量类型声明
│
├── index.html                        # Vite 入口 HTML
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json                     # 继承 tsconfig.base.json
└── package.json
```

---

## 3. 服务端应用详细结构 `apps/server/`

```
apps/server/
├── src/
│   ├── index.ts                      # 服务入口（启动 Hono app + Adapter）
│   │
│   ├── app.ts                        # Hono app 实例（挂载路由和中间件）
│   │
│   ├── routes/                       # ① API 路由层（薄层：仅参数解析 + 调用 service + 序列化响应）
│   │   ├── status.route.ts
│   │   ├── tasks.route.ts
│   │   ├── cost.route.ts
│   │   ├── memory.route.ts
│   │   ├── approval.route.ts
│   │   ├── auth.route.ts
│   │   └── health.route.ts
│   │
│   ├── middleware/                    # ② 中间件层
│   │   ├── auth.middleware.ts         #   JWT 验证 + RBAC 鉴权
│   │   ├── sanitize.middleware.ts     #   出站响应脱敏
│   │   ├── rate-limit.middleware.ts   #   速率限制
│   │   ├── error-handler.middleware.ts #  全局错误捕获 + 格式化
│   │   └── request-logger.middleware.ts # 请求日志
│   │
│   ├── services/                     # ③ 业务逻辑层（核心大脑）
│   │   ├── event-collector.service.ts #   事件标准化 + 入库
│   │   ├── narrative-engine.service.ts #  技术事件 → 人话翻译
│   │   ├── memory-governance.service.ts # 记忆查看/删除/过期
│   │   ├── cost-tracker.service.ts    #   成本计算 + 预算预警
│   │   ├── approval-flow.service.ts   #   审批流 + 指令回传
│   │   ├── alert-evaluator.service.ts #   异常检测 + 告警触发
│   │   └── auth.service.ts           #   认证 + Token 管理
│   │
│   ├── adapters/                     # ④ OpenClaw 集成适配器层
│   │   ├── adapter.interface.ts      #   适配器统一接口定义
│   │   ├── file-watcher.adapter.ts   #   文件变更监听
│   │   ├── cli-bridge.adapter.ts     #   CLI 命令执行 + 输出解析
│   │   ├── webhook-receiver.adapter.ts #  Webhook 接收处理
│   │   └── gateway-probe.adapter.ts  #   Gateway 心跳探测
│   │
│   ├── realtime/                     # ⑤ 实时推送层
│   │   ├── sse-manager.ts            #   SSE 连接池管理
│   │   ├── ws-manager.ts             #   WebSocket 连接池管理
│   │   └── event-bus.ts              #   进程内事件总线（MVP） / Redis adapter（V2）
│   │
│   ├── db/                           # ⑥ 数据访问层
│   │   ├── schema.ts                 #   Drizzle schema 定义
│   │   ├── migrations/               #   数据库迁移文件
│   │   ├── client.ts                 #   数据库连接实例
│   │   └── queries/                  #   按领域组织的查询函数
│   │       ├── events.query.ts
│   │       ├── tasks.query.ts
│   │       ├── approvals.query.ts
│   │       └── audit-logs.query.ts
│   │
│   ├── lib/                          # ⑦ 服务端工具函数
│   │   ├── logger.ts                 #   Pino 日志实例
│   │   ├── config.ts                 #   环境配置（Zod 校验 env vars）
│   │   ├── crypto.ts                 #   加密 / 哈希工具
│   │   └── errors.ts                 #   自定义错误类体系
│   │
│   └── types/                        # ⑧ 服务端专属类型
│       └── hono.d.ts                 #   Hono Context 类型扩展
│
├── narrative-rules.yaml              # 叙事翻译规则配置
├── drizzle.config.ts                 # Drizzle ORM 配置
├── tsconfig.json
└── package.json
```

---

## 4. 共享包结构 `packages/shared/`

```
packages/shared/
├── src/
│   ├── types/                        # ① 领域模型类型（前后端共享的唯一类型来源）
│   │   ├── agent-status.ts           #   AgentStatus 模型
│   │   ├── task-execution.ts         #   TaskExecutionLog 模型
│   │   ├── cost.ts                   #   CostSnapshot 模型
│   │   ├── memory.ts                 #   MemoryEntry 模型
│   │   ├── approval.ts              #   ApprovalRequest 模型
│   │   ├── alert.ts                  #   AlertEvent 模型
│   │   ├── events.ts                 #   ClawEvent 基础事件模型
│   │   └── index.ts                  #   统一导出
│   │
│   ├── validators/                   # ② Zod schemas（运行时校验 + 类型推导）
│   │   ├── agent-status.schema.ts
│   │   ├── task-execution.schema.ts
│   │   ├── approval.schema.ts
│   │   └── index.ts
│   │
│   ├── constants/                    # ③ 共享常量
│   │   ├── event-types.ts            #   事件类型枚举
│   │   ├── status-codes.ts           #   Agent 状态枚举
│   │   ├── risk-levels.ts            #   风险等级枚举
│   │   └── index.ts
│   │
│   └── utils/                        # ④ 纯函数工具（零依赖、零副作用）
│       ├── format-cost.ts            #   金额格式化
│       ├── format-tokens.ts          #   Token 数格式化
│       ├── mask-sensitive.ts         #   脱敏工具
│       └── index.ts
│
├── tsconfig.json
└── package.json
```

---

## 5. 职责边界与调用规则 (Dependency Rules)

### 5.1 分层架构调用方向图

```
                    ┌──────────────────────┐
                    │     packages/shared   │
                    │  (Types, Validators,  │
                    │   Constants, Utils)   │
                    └──────┬───────────────┘
                           │ 被所有层导入（只读依赖）
                    ┌──────┴───────────────┐
                    │                      │
              ┌─────▼─────┐        ┌──────▼──────┐
              │ apps/web  │        │ apps/server │
              └───────────┘        └─────────────┘
```

### 5.2 前端内部调用规则

```
┌─────────────────────────────────────────────────┐
│                    apps/web                      │
│                                                 │
│  ┌─── app/ (Shell) ─────────────────────┐       │
│  │  可以导入: features/, components/,    │       │
│  │           hooks/, stores/, lib/       │       │
│  └───────────────────────────────────────┘       │
│           │ 组装                                 │
│  ┌─── features/ (功能模块) ─────────────┐       │
│  │  可以导入: components/, hooks/,       │       │
│  │           services/, stores/, lib/    │       │
│  │  ❌ 禁止导入: 其他 feature/           │       │
│  └───────────────────────────────────────┘       │
│           │ 使用                                 │
│  ┌─── hooks/ (共享 Hooks) ──────────────┐       │
│  │  可以导入: services/, stores/, lib/   │       │
│  │  ❌ 禁止导入: components/, features/  │       │
│  └───────────────────────────────────────┘       │
│           │ 调用                                 │
│  ┌─── services/ (API 客户端) ───────────┐       │
│  │  可以导入: lib/, @clawview/shared     │       │
│  │  ❌ 禁止导入: components/, features/, │       │
│  │              hooks/, stores/          │       │
│  └───────────────────────────────────────┘       │
│           │ 使用                                 │
│  ┌─── components/ (纯 UI) ──────────────┐       │
│  │  可以导入: lib/, @clawview/shared     │       │
│  │  ❌❌ 绝对禁止: services/, stores/,   │       │
│  │        hooks/ (不可发请求/读全局状态)  │       │
│  │  组件通过 props 接收一切数据           │       │
│  └───────────────────────────────────────┘       │
│                                                 │
│  ┌─── lib/ (纯工具) ───────────────────┐        │
│  │  可以导入: @clawview/shared           │       │
│  │  ❌ 禁止导入: 项目内任何其他目录       │       │
│  └───────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

### 5.3 后端内部调用规则

```
┌─────────────────────────────────────────────────┐
│                   apps/server                    │
│                                                 │
│  ┌─── routes/ (路由层) ─────────────────┐       │
│  │  可以调用: services/, middleware/      │       │
│  │  ❌ 禁止调用: adapters/, db/, realtime/ │     │
│  │  职责: 仅做参数解析→调用 service→返回  │       │
│  └───────────────────────────────────────┘       │
│           │                                     │
│  ┌─── services/ (业务逻辑层) ───────────┐       │
│  │  可以调用: db/queries/, adapters/,    │       │
│  │           realtime/, lib/             │       │
│  │  ❌ 禁止调用: routes/, middleware/     │       │
│  │  职责: 核心业务逻辑的唯一归属          │       │
│  └───────────────────────────────────────┘       │
│           │                                     │
│  ┌─── adapters/ (集成适配器层) ─────────┐       │
│  │  可以调用: lib/, @clawview/shared     │       │
│  │  ❌ 禁止调用: services/, routes/,     │       │
│  │              db/, realtime/           │       │
│  │  职责: 只负责与 OpenClaw 交互，       │       │
│  │        产出标准化 ClawEvent           │       │
│  └───────────────────────────────────────┘       │
│                                                 │
│  ┌─── db/ (数据访问层) ────────────────┐        │
│  │  可以调用: lib/, @clawview/shared     │       │
│  │  ❌ 禁止调用: services/, routes/,     │       │
│  │              adapters/, realtime/     │       │
│  │  职责: 数据库 schema + 查询函数       │       │
│  └───────────────────────────────────────┘       │
│                                                 │
│  ┌─── realtime/ (推送层) ──────────────┐        │
│  │  可以调用: lib/                       │       │
│  │  ❌ 禁止调用: services/, routes/,     │       │
│  │              adapters/, db/           │       │
│  │  职责: 管理连接池 + 广播事件          │       │
│  └───────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

### 5.4 绝对禁止的跨边界调用（Red Lines）

| # | 禁止规则 | 原因 |
|---|----------|------|
| R-1 | **`components/` 禁止导入 `services/`** | UI 组件必须是纯展示的，数据通过 props 注入 |
| R-2 | **`components/` 禁止导入 `stores/`** | UI 组件不得直接读写全局状态 |
| R-3 | **`features/A` 禁止导入 `features/B`** | 功能模块之间零耦合，跨功能通信通过全局 store 或事件 |
| R-4 | **`routes/` 禁止直接调用 `db/`** | 路由层不得绕过 service 直接操作数据库 |
| R-5 | **`adapters/` 禁止调用 `services/`** | 适配器只产出事件，不参与业务决策 |
| R-6 | **`apps/web` 禁止导入 `apps/server` 内部模块** | 前后端只通过 HTTP/SSE/WS 和 `@clawview/shared` 类型通信 |
| R-7 | **`packages/shared` 禁止导入任何 `apps/` 内部模块** | shared 是最底层包，依赖方向只能向下 |
| R-8 | **`lib/` 禁止导入同级或上级目录** | 工具函数层是依赖图的叶子节点 |

### 5.5 依赖方向总结

```
依赖只允许从上往下流动，绝不允许向上或同级横向依赖：

  app/ (Shell)
    ↓
  features/ (功能模块)
    ↓
  hooks/ (共享 Hooks)
    ↓
  services/ (API 客户端)          stores/ (全局状态)
    ↓                               ↓
  lib/ (纯工具)  ←───────────  @clawview/shared
```

---

## 6. 文件命名规范

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| React 组件 | `kebab-case.tsx` | `status-badge.tsx` |
| Hook | `use-[name].ts` | `use-realtime.ts` |
| Store | `[name].store.ts` | `auth.store.ts` |
| Service (前端) | `[name].api.ts` | `status.api.ts` |
| Service (后端) | `[name].service.ts` | `event-collector.service.ts` |
| Route | `[name].route.ts` | `status.route.ts` |
| Middleware | `[name].middleware.ts` | `auth.middleware.ts` |
| Adapter | `[name].adapter.ts` | `file-watcher.adapter.ts` |
| Schema (Zod) | `[name].schema.ts` | `agent-status.schema.ts` |
| DB Query | `[name].query.ts` | `events.query.ts` |
| 类型定义 | `[name].ts` (在 types/ 下) | `agent-status.ts` |
| 配置文件 | `[name].config.ts` | `vite.config.ts` |
| 测试文件 | `[name].test.ts(x)` | `status-badge.test.tsx` |
| 常量 | `[name].ts` (在 constants/ 下) | `event-types.ts` |
