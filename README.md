# Process Discovery Assistant

AI 驱动的业务流程发现助手。通过结构化访谈收集员工工作流、痛点与系统依赖，并为企业咨询顾问与管理员提供流程全景、协作网络与综合分析。

基于 [DeepSeek](https://www.deepseek.com/) API（默认 `deepseek-v4-pro`）。

## 功能概览

| 角色 | 能力 |
|------|------|
| **咨询顾问** | 管理诊断项目（Engagement）、查看工作台、生成假设/发现/交付物 |
| **企业管理员** | 查看组织流程全景、员工协作关系图、企业级分析报告 |
| **员工** | AI 访谈门户，梳理个人工作流程与协作关系 |

核心能力包括：对话式流程采集、流程图与 Mermaid 可视化、企业协作网络（React Flow）、SQLite 持久化、咨询工作台合成。

## 技术栈

- **后端**：Node.js、Express、TypeScript、`better-sqlite3`
- **前端**：React 19、Vite、Tailwind CSS、TanStack Query、XYFlow
- **AI**：OpenAI 兼容接口（DeepSeek）

## 环境要求

- Node.js 18+
- npm

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone https://github.com/Theclues/process-discovery-assistant.git
cd process-discovery-assistant

npm install
cd client && npm install && cd ..
```

### 2. 配置

复制示例配置并填入 DeepSeek API Key：

```bash
cp config.example.json config.json
```

`config.json` 示例：

```json
{
  "deepseekApiKey": "your-deepseek-api-key-here",
  "deepseekModel": "deepseek-v4-pro",
  "deepseekBaseUrl": "https://api.deepseek.com",
  "port": 3000
}
```

> `config.json` 已加入 `.gitignore`，请勿提交密钥。

### 3. 开发模式

**终端 1 — 后端 API（端口 3000）：**

```bash
npm run dev
```

**终端 2 — 前端开发服务器（端口 5173，代理 `/api`）：**

```bash
npm run dev:ui
```

浏览器打开 [http://localhost:5173](http://localhost:5173)，在登录页选择角色并创建/选择企业后使用。

### 4. 生产构建

```bash
npm run build
npm start
```

构建后由后端在 `http://localhost:3000` 同时提供 API 与静态前端（`client/dist`）。

## 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动后端（tsx 热运行） |
| `npm run dev:ui` | 启动 Vite 前端开发服务器 |
| `npm run build` | 构建前端 + 编译后端 TypeScript |
| `npm start` | 运行编译后的服务 |
| `npm test` | 运行单元测试 |

## 项目结构

```
process-discovery-assistant/
├── client/           # React 前端
├── src/
│   ├── analysis/     # 流程分析、网络、模式检测
│   ├── consulting/   # 咨询工作台与合成
│   ├── dialogue/     # 访谈对话引擎
│   ├── llm/          # DeepSeek 客户端与提示词
│   ├── storage/      # SQLite 数据层
│   ├── viz/          # 流程图、报告、React Flow 数据
│   └── web/          # HTTP API 路由
├── data/             # 本地数据库（不提交）
├── config.example.json
└── static/           # 无前端构建时的简易静态页回退
```

## 数据与隐私

- 本地 SQLite 数据库位于 `data/`
- 访谈会话缓存位于 `data/sessions/`（已忽略，不进入版本库）
- 首次运行会自动创建所需目录与表结构

## 许可证

ISC
