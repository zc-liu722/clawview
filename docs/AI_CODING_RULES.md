# ClawView — AI 编程助手强制军规

> **文档版本**: v1.0.0
> **受众**: 所有参与 ClawView 代码编写的 AI 编程助手和人类开发者。
> **执行级别**: 本文档中标记为 ❌ FORBIDDEN 的规则是**绝对禁止**，违反即回滚。标记为 ⚠️ REQUIRED 的规则是**强制要求**。标记为 💡 PREFERRED 的规则是**强烈建议**。

---

## 1. 代码风格规范

### 1.1 语言与运行时

- ⚠️ REQUIRED: 全项目 **TypeScript strict mode**（`"strict": true`），不允许 `any` 类型逃逸。
- ⚠️ REQUIRED: 使用 **Biome** 作为唯一 linter + formatter（不使用 ESLint + Prettier 组合，减少工具链复杂度）。
- ⚠️ REQUIRED: 目标运行时为 **Node 20 LTS+** (服务端) 和 **ES2022+** (前端)。

### 1.2 命名公约

| 场景 | 命名格式 | 示例 |
|------|----------|------|
| 变量、函数、参数 | `camelCase` | `taskId`, `formatCost()` |
| React 组件 | `PascalCase` | `StatusBadge`, `TaskFlowPanel` |
| 类型、接口 | `PascalCase` | `AgentStatus`, `ApprovalRequest` |
| 枚举值 | `SCREAMING_SNAKE_CASE` | `AGENT_ONLINE`, `RISK_HIGH` |
| 常量 | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT`, `SSE_HEARTBEAT_INTERVAL_MS` |
| 文件名 | `kebab-case` | `status-badge.tsx`, `event-collector.service.ts` |
| 数据库表/列 | `snake_case` | `task_execution_logs`, `created_at` |
| URL 路径 | `kebab-case` | `/api/v1/task-flow`, `/api/v1/agent-status` |
| 环境变量 | `SCREAMING_SNAKE_CASE` with `CLAWVIEW_` 前缀 | `CLAWVIEW_JWT_SECRET`, `CLAWVIEW_DB_URL` |

### 1.3 函数签名规范

- ⚠️ REQUIRED: 函数参数超过 3 个时，使用 **options object pattern**：

```typescript
// ❌ BAD
function createTask(name: string, agentId: string, priority: number, timeout: number) {}

// ✅ GOOD
interface CreateTaskOptions {
  name: string;
  agentId: string;
  priority: number;
  timeoutMs: number;
}
function createTask(options: CreateTaskOptions) {}
```

- ⚠️ REQUIRED: 时间相关参数必须带单位后缀：`timeoutMs`、`intervalSec`、`ttlMin`。
- ⚠️ REQUIRED: 布尔参数不使用否定形式（`isEnabled` ✅, `isNotDisabled` ❌）。

### 1.4 注释要求

- ❌ FORBIDDEN: 不写描述代码表面行为的注释（"// 遍历数组"、"// 返回结果"）。
- ⚠️ REQUIRED: 每个 `packages/shared/types/` 中的 interface 字段必须写 JSDoc 注释，说明**业务含义**。
- ⚠️ REQUIRED: 所有 `services/` 中的 public 函数必须写 JSDoc，说明**职责、参数语义、异常情况**。
- 💡 PREFERRED: 复杂算法或非直觉逻辑写 `// WHY:` 注释解释**为什么**这么做。
- 💡 PREFERRED: 临时方案写 `// TODO(username):` 并附带 issue 链接。

### 1.5 导入排序

⚠️ REQUIRED: 导入按以下顺序分组，组间空行分隔：

```typescript
// 1. Node 内置模块
import { resolve } from 'node:path';

// 2. 第三方库
import { Hono } from 'hono';
import { z } from 'zod';

// 3. Monorepo 内部包
import { AgentStatus } from '@clawview/shared';

// 4. 项目内部模块（按层级从远到近）
import { apiClient } from '@/services/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatCost } from '@/lib/format';
```

---

## 2. Error Handling 规范

### 2.1 Async/Await 错误处理

- ❌ FORBIDDEN: 不允许裸 `await`（不带 `try-catch` 或 `.catch()` 的 async 调用）。

```typescript
// ❌ FORBIDDEN — 未处理的 Promise rejection 会导致静默失败
const data = await fetchStatus();

// ✅ REQUIRED — 明确处理错误
try {
  const data = await fetchStatus();
} catch (error) {
  // 处理 or 上抛自定义错误
}

// ✅ ALSO OK — 在调用方统一 catch
const result = await fetchStatus().catch(handleFetchError);
```

### 2.2 错误类型体系

⚠️ REQUIRED: 后端使用统一的自定义错误类体系：

```typescript
abstract class ClawViewError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
}

class NotFoundError extends ClawViewError { /* ... */ }
class UnauthorizedError extends ClawViewError { /* ... */ }
class ValidationError extends ClawViewError { /* ... */ }
class AdapterError extends ClawViewError { /* ... */ }
class RateLimitError extends ClawViewError { /* ... */ }
```

- ❌ FORBIDDEN: 直接 `throw new Error('something went wrong')`。必须使用对应的自定义错误类。
- ⚠️ REQUIRED: 全局 error handler middleware 负责将 `ClawViewError` 转为标准 JSON 响应。

### 2.3 前端错误处理

- ⚠️ REQUIRED: 所有 API 调用失败必须给用户 **可理解的反馈**（Toast / Error State），不允许静默吞错。
- ⚠️ REQUIRED: 每个页面级路由包裹 `ErrorBoundary`，捕获渲染时异常并展示降级 UI。
- ⚠️ REQUIRED: SSE/WebSocket 断连时自动重连，并在 UI 上展示连接状态。

---

## 3. 状态管理规范

### 3.1 状态分类

ClawView 的状态分为两类，使用不同工具管理：

| 状态类型 | 管理工具 | 示例 |
|----------|----------|------|
| **服务端状态** (Server State) | TanStack Query | Agent 列表、任务历史、成本数据 |
| **客户端状态** (Client State) | Zustand | 认证信息、UI 偏好、连接状态 |

- ❌ FORBIDDEN: 不允许用 Zustand 缓存服务端数据（那是 TanStack Query 的职责）。
- ❌ FORBIDDEN: 不允许用 TanStack Query 管理纯客户端状态（如 sidebar 展开/收起）。
- ❌ FORBIDDEN: 不允许使用 React Context 做频繁变化的状态管理（性能问题）。只用于低频变化的配置型数据（Theme、Locale）。

### 3.2 实时数据流转

```
SSE/WebSocket 消息到达
        │
        ▼
  services/sse-client.ts 接收
        │
        ▼
  按事件类型分发到对应 Zustand store
  或 TanStack Query 的 queryClient.setQueryData()
        │
        ▼
  React 组件自动重渲染
```

- ⚠️ REQUIRED: 实时推送的数据通过 `queryClient.setQueryData()` 注入 TanStack Query cache，而非绕过缓存直接更新 UI。这保证了缓存一致性和离线恢复能力。

### 3.3 Zustand Store 规范

- ⚠️ REQUIRED: 每个 feature 有自己独立的 store slice 文件。
- ⚠️ REQUIRED: Store 中只存放最小必要状态，派生数据用 selector 计算。
- ❌ FORBIDDEN: Store 中不允许有副作用（API 调用、DOM 操作）。副作用放在 hooks 或 services 中。
- 💡 PREFERRED: 使用 `immer` middleware 简化嵌套状态更新。

---

## 4. React 组件规范

### 4.1 组件分层

| 层级 | 位置 | 职责 | 允许的依赖 |
|------|------|------|------------|
| **UI 组件** | `components/ui/` | 设计系统原子 | 仅 `lib/`、`@clawview/shared` |
| **组合组件** | `components/composed/` | UI 组件的有意义组合 | 仅 `components/ui/`、`lib/` |
| **功能组件** | `features/*/components/` | 带业务逻辑的组件 | 可使用 hooks、stores、services |
| **页面组件** | `app/` 路由对应 | 页面级组装 | 可导入 features |

### 4.2 组件编写规则

- ⚠️ REQUIRED: `components/ui/` 和 `components/composed/` 下的组件是**纯函数组件**——输出仅由 props 决定，不使用 hooks（useEffect/useState 可以用于 UI 状态如 hover、open，但不得调用 API 或读全局 store）。
- ⚠️ REQUIRED: 所有组件使用 `function` 声明（不用 `const Comp = () =>`），便于 React DevTools 显示名称。
- ⚠️ REQUIRED: 组件 props 类型紧跟组件定义，不拆到单独文件：

```typescript
interface StatusBadgeProps {
  status: AgentStatusCode;
  lastHeartbeat: number;
}

function StatusBadge({ status, lastHeartbeat }: StatusBadgeProps) {
  // ...
}
```

- 💡 PREFERRED: 大组件拆分为 Container（数据获取 + 逻辑）+ Presentational（纯渲染）模式。

### 4.3 移动端优先

- ⚠️ REQUIRED: 所有样式以 375px 宽度为基准编写，使用 Tailwind 的 `sm:` / `md:` / `lg:` 做渐进增强。
- ⚠️ REQUIRED: 触摸目标最小 44×44px（Apple HIG 标准）。
- ⚠️ REQUIRED: 列表使用虚拟滚动（`@tanstack/react-virtual`）处理超过 50 条数据的场景。
- 💡 PREFERRED: 关键交互提供触觉反馈（Vibration API，有则用之）。

---

## 5. API 设计规范

### 5.1 URL 结构

```
/api/v1/{resource}                    # 集合
/api/v1/{resource}/{id}               # 单个资源
/api/v1/{resource}/{id}/{sub-resource} # 子资源
```

- ⚠️ REQUIRED: 资源名使用**复数 kebab-case**（`/tasks`, `/memory-entries`）。
- ⚠️ REQUIRED: 所有 API 路由以 `/api/v1` 开头，预留版本升级空间。

### 5.2 响应格式

⚠️ REQUIRED: 统一响应信封格式：

```typescript
// 成功
{ "data": T, "meta"?: { pagination, timing } }

// 错误
{ "error": { "code": string, "message": string, "details"?: unknown } }
```

- ❌ FORBIDDEN: API 不得返回裸数组或裸值。必须包裹在 `{ "data": ... }` 中。
- ⚠️ REQUIRED: 错误响应必须包含机器可读的 `code`（如 `AGENT_NOT_FOUND`）和人类可读的 `message`。

### 5.3 SSE 事件格式

```
event: {eventType}\n
data: {JSON payload}\n\n
```

- ⚠️ REQUIRED: SSE 事件类型使用 `snake_case`（`status_change`, `step_update`, `cost_update`）。
- ⚠️ REQUIRED: 每 30 秒发送一次 `:heartbeat\n\n` 保活。

---

## 6. 安全编码规范

### 6.1 敏感数据

- ❌ FORBIDDEN: 前端代码中不得出现任何 API Key、Token、Secret——即使是环境变量也不行（Vite 会打包进产物）。
- ❌ FORBIDDEN: 日志中不得打印完整的 Token、密码、API Key。必须使用 `mask()` 工具函数处理。
- ⚠️ REQUIRED: 所有环境变量通过 Zod schema 校验，缺少必要变量时**启动失败**而非运行时崩溃。

### 6.2 输入校验

- ⚠️ REQUIRED: 所有外部输入（HTTP body、query、params、WebSocket message）使用 Zod 校验。
- ❌ FORBIDDEN: 不信任前端传来的任何数据，包括用户 ID 和权限声明。服务端从 JWT 中提取身份信息。

### 6.3 依赖安全

- ⚠️ REQUIRED: 每个依赖必须锁定确切版本（`pnpm-lock.yaml`），禁止 `*` 或 `latest`。
- 💡 PREFERRED: 尽量选择零依赖或少依赖的库（这也是选择 Hono、Zustand、Drizzle 的原因之一）。

---

## 7. 反模式警告（Anti-Patterns）

以下是在 ClawView 项目中**绝对不允许出现**的代码写法：

### AP-1: ❌ 前端硬编码超时 / 间隔时间

```typescript
// ❌ FORBIDDEN
setTimeout(retry, 3000);
setInterval(poll, 5000);

// ✅ REQUIRED — 从常量或配置中读取
import { RETRY_DELAY_MS, POLL_INTERVAL_MS } from '@/lib/constants';
setTimeout(retry, RETRY_DELAY_MS);
```

**理由**: 超时和间隔是运维参数，必须集中管理。硬编码导致调优时需要全局搜索。

### AP-2: ❌ 不带错误处理的 async 调用

```typescript
// ❌ FORBIDDEN
async function loadStatus() {
  const data = await fetchAgentStatus();
  setStatus(data);
}

// ✅ REQUIRED
async function loadStatus() {
  try {
    const data = await fetchAgentStatus();
    setStatus(data);
  } catch (error) {
    reportError(error);
    setError(toUserMessage(error));
  }
}
```

**理由**: 未处理的 rejection 在移动端会导致页面白屏而用户无任何反馈。

### AP-3: ❌ UI 组件直接发网络请求

```typescript
// ❌ FORBIDDEN — 在 components/ 目录下
function StatusBadge() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch('/api/v1/status').then(r => r.json()).then(setStatus);
  }, []);
  return <Badge>{status}</Badge>;
}

// ✅ REQUIRED — 数据由 feature 或 hook 注入
function StatusBadge({ status }: { status: AgentStatusCode }) {
  return <Badge>{status}</Badge>;
}
```

**理由**: 违反关注点分离。UI 组件不可测试、不可复用、不可在 Storybook 中展示。

### AP-4: ❌ 使用 `any` 类型

```typescript
// ❌ FORBIDDEN
function processEvent(event: any) { /* ... */ }
const data = response as any;

// ✅ REQUIRED — 使用具体类型或 unknown + 类型守卫
function processEvent(event: ClawEvent) { /* ... */ }
function processUnknown(data: unknown) {
  const parsed = clawEventSchema.parse(data);
}
```

**理由**: `any` 会让整个类型系统塌方。一个 `any` 会感染所有下游类型推导。

### AP-5: ❌ 在 Adapter 层做业务决策

```typescript
// ❌ FORBIDDEN — Adapter 不应该判断是否需要告警
class FileWatcherAdapter {
  onTranscriptChange(content: string) {
    if (this.detectAnomaly(content)) {
      this.sendAlertToUser(content); // ← 越权！
    }
  }
}

// ✅ REQUIRED — Adapter 只产出标准化事件，由 Service 层决策
class FileWatcherAdapter {
  onTranscriptChange(content: string) {
    const event = this.normalize(content);
    this.eventBus.emit(event); // Service 层消费并决策
  }
}
```

**理由**: Adapter 是"翻译官"，不是"决策者"。业务逻辑混入 adapter 会导致 OpenClaw 版本升级时逻辑难以迁移。

### AP-6: ❌ 直接操作 DOM

```typescript
// ❌ FORBIDDEN
document.getElementById('status').innerHTML = statusText;
document.querySelector('.alert').classList.add('visible');

// ✅ REQUIRED — 通过 React 状态驱动 UI
const [visible, setVisible] = useState(false);
return <Alert className={cn(visible && 'visible')} />;
```

**理由**: 绕过 React 的 Virtual DOM 会导致状态不一致和内存泄漏。

### AP-7: ❌ 在组件中使用 `index` 作为 key

```typescript
// ❌ FORBIDDEN — 列表项增删时会导致错误的 DOM 复用
{steps.map((step, index) => <StepCard key={index} step={step} />)}

// ✅ REQUIRED — 使用稳定的业务 ID
{steps.map((step) => <StepCard key={step.id} step={step} />)}
```

**理由**: 实时步骤流会频繁增删项，index key 导致动画错乱和状态泄漏。

### AP-8: ❌ 原始 SQL 字符串拼接

```typescript
// ❌ FORBIDDEN
const result = db.exec(`SELECT * FROM tasks WHERE id = '${taskId}'`);

// ✅ REQUIRED — 使用 Drizzle ORM 的参数化查询
const result = await db.select().from(tasks).where(eq(tasks.id, taskId));
```

**理由**: SQL 注入是 OWASP Top 10 之首。

### AP-9: ❌ 将用户 Token 存储在 localStorage

```typescript
// ❌ FORBIDDEN
localStorage.setItem('access_token', token);

// ✅ REQUIRED — httpOnly cookie（BFF 设置）或内存中管理
// Access Token 存内存（Zustand store），Refresh Token 由 BFF 设为 httpOnly cookie
```

**理由**: localStorage 对 XSS 攻击零防御。httpOnly cookie 不可被 JS 读取。

### AP-10: ❌ 在 `useEffect` 中直接修改外部 Store 且无 cleanup

```typescript
// ❌ FORBIDDEN — 组件卸载后仍在写入 store，内存泄漏 + 状态污染
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => store.addEvent(JSON.parse(e.data));
}, []);

// ✅ REQUIRED — 有 cleanup
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => store.addEvent(JSON.parse(e.data));
  return () => ws.close();
}, []);
```

**理由**: 移动端页面切换频繁，无 cleanup 的 WebSocket 会越积越多。

---

## 8. 测试规范

### 8.1 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest | `lib/`、`services/`、`stores/`、纯函数 |
| 组件测试 | Vitest + Testing Library | `components/`——快照 + 交互 |
| 集成测试 | Vitest + supertest | `routes/` + `services/` 联合 |
| E2E 测试 | Playwright | 关键用户路径（状态查看 → 审批流） |

### 8.2 测试规则

- ⚠️ REQUIRED: `packages/shared/` 中的所有 validator 函数必须有单元测试。
- ⚠️ REQUIRED: 每个 API route 至少有一个 happy path + 一个 error path 集成测试。
- 💡 PREFERRED: 新的 bug fix 附带回归测试。
- ❌ FORBIDDEN: 测试中不允许 mock `Date.now()` 以外的全局对象。使用依赖注入替代。

---

## 9. Git 规范

### 9.1 Commit Message

使用 **Conventional Commits**：

```
<type>(<scope>): <description>

[optional body]
[optional footer(s)]
```

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改行为） |
| `perf` | 性能优化 |
| `test` | 测试 |
| `docs` | 文档 |
| `chore` | 工程配置 |
| `ci` | CI/CD |

Scope 使用 monorepo 包名：`web`、`server`、`shared`。

示例：`feat(web): add real-time step flow component`

### 9.2 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 生产代码，受保护 |
| `dev` | 开发集成分支 |
| `feat/*` | 功能分支 |
| `fix/*` | 修复分支 |
| `release/*` | 发布分支 |

---

## 10. 性能预算

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| **首屏加载 (FCP)** | < 1.5s (4G 网络) | Lighthouse |
| **可交互时间 (TTI)** | < 3s (4G 网络) | Lighthouse |
| **JS Bundle 总大小** | < 200KB gzipped | Vite build output |
| **SSE 首次数据** | < 500ms (连接建立后) | 自定义 timing |
| **API P99 延迟** | < 200ms | Prometheus |
| **内存占用 (PWA)** | < 50MB | Chrome DevTools |
