# ClawView 项目总结

## 项目是什么

ClawView 是一个面向 OpenClaw 的移动端透明控制台。

它不替代 OpenClaw，而是在 OpenClaw 现有能力之上补一层更适合普通用户的可视化体验，把原本分散在 transcript、memory、状态命令和日志里的信息，整理成一个更容易理解、更容易信任的控制界面。

一句话概括：

> 让用户第一次真正看清 AI 助理在做什么、花了多少钱、记住了什么、哪里出了问题。

## 解决什么问题

ClawView 主要解决 OpenClaw 在真实使用中的几类体验缺口：

- 用户不知道 AI 是否在线
- 用户不知道当前任务推进到了哪一步
- 用户不知道 token 和费用消耗情况
- 用户不知道 AI 当前记住了什么
- 用户难以及时发现异常、失联和风险状态

这些问题本质上都属于同一个方向：透明度与信任基础设施。

## 核心能力

- 状态面板：在线、思考中、调工具中、等待授权、异常
- 任务步骤流：把 transcript 翻译成用户可读的人话步骤
- 成本视图：按任务和时间维度展示 token 与费用
- 记忆中心：查看和管理本地记忆内容
- 告警系统：帮助用户发现失联、失败和高风险状态
- 移动优先：适合手机端随时查看 AI 助理运行情况

## 当前技术方案

项目采用 `pnpm workspace` monorepo：

- `apps/web`：React 19 + Vite 的移动端前端
- `apps/server`：Hono + TypeScript 的 BFF / API 服务
- `packages/shared`：前后端共享类型、常量和校验逻辑

当前 `openclaw` 模式以轻量直连为主：

- 读取 transcript / session 文件
- 读取 `MEMORY.md`、`memory/*.md`、`workspace/*.md`
- 解析 usage / pricing / alert 相关信息
- 在不侵入 OpenClaw 本体的情况下完成可视化接入

## 最近完成的关键增强

这一轮主要把项目从“更适合作者机器”推进到了“更适合别人机器部署”：

- 增强了 OpenClaw、`clawd`、sessions、memory 目录的自动探测
- 去掉了对单一 macOS 路径和固定 CLI 行为的强绑定
- 支持通过环境变量自定义 OpenClaw CLI、gateway usage 命令和重启命令
- 改造了 Docker 与本机启动脚本，提升跨环境可部署性
- 新增 `smoke-check.sh`，支持上线前一键自检
- 新增 GitHub 一键安装脚本，适合小白复制命令直接部署
- 新增远程分享脚本，支持通过 Tailscale 在非同 Wi-Fi 环境查看

## 当前项目状态

从产品和工程角度看，ClawView 已具备一个清晰、完整、可演示、可部署的第一阶段版本：

- 产品定位明确
- 真实场景问题聚焦清晰
- 前后端结构完整
- 本地与 Docker 双启动路径可用
- 小白安装、自检、远程访问链路已经补齐

它已经不只是一个界面原型，而是一个可以直接拿去给 OpenClaw 用户试用的产品化仓库。

## 适合 GitHub 的项目介绍

### 仓库描述

ClawView is a mobile-first transparency console for OpenClaw, turning status, steps, cost, memory, and alerts into a user-friendly control experience.

### 仓库首页短介绍

ClawView helps OpenClaw users see what their agent is doing, what it costs, what it remembers, and when something goes wrong, through a mobile-friendly dashboard that is easy to deploy and easy to trust.

### 中文短介绍

ClawView 是一个面向 OpenClaw 的移动端透明控制台，把状态、步骤、成本、记忆和告警转化成普通用户也能看懂的控制界面。
