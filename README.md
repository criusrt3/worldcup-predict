# 绿茵神算 · 可视化控制台

2026 世界杯 AI 预测的可视化操作界面，基于 [worldcup2026-prediction-skill](https://github.com/TradingAi666/worldcup2026-prediction-skill)。

## 功能

- 12 小组可视化选队 + 组内 6 场快捷对阵
- 揭幕战 / 死亡之组等快捷入口
- 比分牌 + 胜平负概率条 + 关键因子 + 关键球员
- 演示模式（无需 API Key）与 DeepSeek API 模式
- **双主题**：夜间球场 / 白天亮白（右上角一键切换，偏好本地保存）
- **实时赛况**：ESPN 官方比分（对阵、比分、进行时长、开球时间、球场）
- **历史战果**：筛选「已完赛」，按赛事阶段 + 日期分组回顾
- **神算问答**：对话模式，整合资料库 + 实时赛况 + 分组信息，支持多轮提问
- 本地预测历史

## 快速开始

```bash
cd worldcup-predictor-ui
npm install
npm run dev
```

浏览器打开 http://localhost:5174

## 接入真实 AI

1. 右上角「设置」
2. 关闭「本地神算」
3. 点「DeepSeek」等快速预设，或填写 Base URL + Model
4. 填入对应平台的 API Key
5. 本地用 `npm run dev` 启动（请求经 `/api/chat` 服务端转发，与 [forxx-studio](https://github.com/criusrt3/forxx-studio) 相同）

支持 DeepSeek、OpenAI、Gemini、硅基流动等 OpenAI 兼容接口。线上部署到 Vercel 时会自动启用 `api/chat` 边缘函数。

## 技术栈

Vite + TypeScript + 原生 DOM（零 UI 框架依赖）
