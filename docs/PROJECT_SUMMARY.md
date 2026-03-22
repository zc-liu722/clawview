# ClawView 项目总结

## 1. 项目定位

ClawView 是一个面向 OpenClaw 的移动端透明控制台。

它不替代 OpenClaw，而是在 OpenClaw 现有能力之上补一层更适合普通用户的可视化体验，把原本分散在 transcript、memory、状态命令和日志里的信息，整理成一个更容易理解的产品界面。

一句话概括：

> 让用户第一次真正看清 AI 助理在做什么、花了多少钱、记住了什么、哪里出了问题。

## 2. 解决的问题

ClawView 主要针对 OpenClaw 在用户体验层的几个关键缺口：

- 看不见状态：用户不知道 AI 是否在线、是否还在运行
- 看不懂过程：用户不知道任务执行到了哪一步
- 不清楚成本：用户不知道一次任务和当天累计花费
- 不可治理记忆：用户不知道 AI 记住了什么
- 出错感知弱：用户很难及时发现失败、失联和异常

这些问题本质上都属于同一个方向：信任基础设施。

## 3. 核心能力

- 状态灯：展示在线、思考中、调工具中、等待授权、异常等状态
- 任务步骤流：把底层执行过程翻译成普通用户可读的人话步骤
- 成本追踪：按任务和时间维度呈现 token 与费用
- 记忆中心：查看和管理记忆内容
- 告警系统：提示异常、失联、错误和风险状态
- 轻量接入：直接读取本地 OpenClaw 数据目录，不侵入 OpenClaw 本体

## 4. 当前实现方式

项目目前采用轻量直连 OpenClaw 的方式运行：

- 读取 `sessions/` 下 transcript 数据
- 读取 `MEMORY.md` 和 `memory/*.md`
- 根据最近会话更新时间推断活跃与在线状态

这种方式的优点是接入成本低、兼容性好、对原系统零侵入；限制是审批回传、精确 usage 和更完整的 Gateway 诊断仍有继续增强空间。

## 5. 技术方案

项目采用 `pnpm workspace` monorepo 结构：

- `apps/web`：前端控制台，基于 React + Vite
- `apps/server`：BFF / API，基于 Hono + TypeScript
- `packages/shared`：前后端共享类型、常量和校验逻辑

主要技术栈：

- React 19
- Vite
- Hono
- TypeScript
- Zod
- Zustand
- TanStack Query

## 6. 产品特点

- 移动优先，适合手机端随时查看 AI 助理运行情况
- 适合从“工程视角”翻译到“用户视角”的透明控制体验
- 对 OpenClaw 本体零侵入，便于演示、试用和后续扩展
- 文档较完整，已有 PRD、架构、设计和审计材料，利于继续开发

## 7. 当前阶段判断

从仓库现状来看，ClawView 已经具备一个明确的产品原型和工程骨架：

- 定位清晰
- 文档完整
- 前后端结构明确
- 本地启动路径齐全
- 已支持 mock 与 openclaw 两种模式

如果继续推进，下一阶段最值得投入的方向包括：

- 完善真实数据接入深度
- 补齐更精确的 usage / cost 数据链路
- 加强异常诊断和审批回传能力
- 提升 GitHub 对外展示、部署说明与演示素材

## 8. 适合 GitHub 的对外介绍

中文短介绍：

> ClawView 是一个面向 OpenClaw 的移动端透明控制台，把状态、步骤、成本、记忆和告警转化成普通用户也能看懂的控制界面。

英文短介绍：

> ClawView is a mobile-first transparency console for OpenClaw, turning agent status, steps, cost, memory, and alerts into a user-friendly control experience.
