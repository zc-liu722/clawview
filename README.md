# ClawView

ClawView 是一个面向 OpenClaw 的移动端透明控制台。它把状态、步骤、成本、记忆和告警翻译成普通用户也能看懂的界面，让 AI 助理从“黑盒执行”变成“可见、可懂、可控”。

## 项目简介

ClawView 的核心目标不是替代 OpenClaw，而是在不侵入 OpenClaw 本体的前提下，为用户补上一层体验与信任基础设施。

它主要解决四个问题：

- 用户不知道 AI 现在是否在线、是否在工作
- 用户不知道当前任务做到了哪一步
- 用户不知道正在消耗多少 token 和费用
- 用户不知道 AI 记住了什么、什么时候出错了

当前仓库支持两种运行模式：

- `mock`：演示模式，适合开发和验证界面
- `openclaw`：连接本地 OpenClaw 数据目录，展示真实 transcript 和 memory

## 主要能力

- 移动端优先的透明控制台
- 实时状态展示：在线、思考中、调工具中、等待授权、异常
- 任务步骤流：把 transcript 和工具调用翻译成用户可读过程
- 成本视图：按任务展示 token 与费用变化
- 记忆中心：查看本地记忆内容与变化
- 异常告警：帮助用户发现失联、失败和高风险状态
- 零侵入接入：通过文件和数据目录读取现有 OpenClaw 信息

## 技术栈

- 前端：React 19 + Vite + React Router + TanStack Query + Zustand
- 后端：Hono + TypeScript + Zod + Pino
- Monorepo：pnpm workspace
- 部署方式：本机运行或 Docker Compose

## 项目结构

```text
clawview/
├── apps/
│   ├── web/         # 前端控制台
│   └── server/      # BFF / API 服务
├── packages/
│   └── shared/      # 前后端共享类型与工具
├── docs/            # 架构、PRD、设计与审计文档
├── scripts/         # 启动与引导脚本
└── README.md
```

## 小白一键启动

前提：

- 电脑里已经有 OpenClaw，并且本地存在 OpenClaw 数据目录
- 默认数据目录通常是 `~/.openclaw`

最简单的方式：

1. 双击 `launch-clawview.command`
2. 如果没有 Docker，它会先尝试安装 Docker Desktop
3. 如果 Docker 不可用，会自动回退到本机模式
4. 如果默认路径找不到，会提示选择 OpenClaw 目录
5. 浏览器会自动打开 ClawView

脚本会自动：

- 生成 `.env`
- 将 `CLAWVIEW_DATA_SOURCE` 切到 `openclaw`
- 优先尝试 Docker 模式
- Docker 不可用时回退到本机模式
- 自动接入你的 OpenClaw 数据目录

## 命令行启动

```bash
./scripts/bootstrap-clawview.sh
```

如果你的 OpenClaw 目录不在默认位置：

```bash
./scripts/bootstrap-clawview.sh /path/to/your/openclaw
```

## 直接本机启动

如果你不想使用 Docker，可以直接双击 `launch-local-clawview.command`，或者运行：

```bash
./scripts/launch-local-clawview.sh
```

本机模式会自动：

- 检查 Node.js
- 没有 Node 时先尝试安装 Homebrew，再安装 Node
- 安装 pnpm 依赖
- 启动本机 server 和 web
- 自动打开 `http://localhost:5173`

## 本地开发

```bash
COREPACK_HOME=$PWD/.corepack corepack pnpm install
COREPACK_HOME=$PWD/.corepack corepack pnpm dev
```

开发地址：

- 前端：`http://localhost:5173`
- 服务端：`http://localhost:8787/api/v1/health`

## Docker 部署

先生成配置：

```bash
cp .env.example .env
```

启动：

```bash
docker compose up --build -d
```

访问：

- `http://localhost:3000`

停止：

```bash
docker compose down
```

## 环境变量

参考 `.env.example`

常用项：

- `CLAWVIEW_DATA_SOURCE=openclaw`
- `CLAWVIEW_OPENCLAW_HOME=~/.openclaw`
- `CLAWVIEW_AGENT_NAME=我的 OpenClaw`
- `CLAWVIEW_WEB_PORT=3000`

## 当前真实接入能力

`openclaw` 模式目前使用的是轻量直连方案，不侵入 OpenClaw 本体：

- 读取 `sessions/` 下的 transcript
- 读取 `MEMORY.md` 和 `memory/*.md`
- 根据最近会话更新时间推断在线和活跃状态

这意味着它已经可以提供基础的透明可视化能力；审批回传、精确 usage 计费和更完整的 Gateway 诊断，后续还可以继续增强。

## 校验命令

```bash
COREPACK_HOME=$PWD/.corepack corepack pnpm lint
COREPACK_HOME=$PWD/.corepack corepack pnpm typecheck
COREPACK_HOME=$PWD/.corepack corepack pnpm build
```

## 适合 GitHub 的一句话介绍

ClawView is a mobile-first transparency console for OpenClaw, turning agent status, steps, cost, memory, and alerts into a user-friendly control experience.
