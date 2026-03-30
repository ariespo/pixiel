# Terminal Care - AI 聊天游戏

一个复古像素风格的 AI 聊天叙事游戏。玩家扮演测试官，通过一款神秘的聊天软件与名叫「夏目」的少女建立联系——而她似乎隐瞒着什么秘密。

## 快速开始（一键启动）

### Windows 用户
双击运行 `start.bat`，或在 PowerShell/CMD 中执行：
```bash
npm install
npm start
```

### macOS/Linux 用户
```bash
npm install
npm start
```

访问 http://localhost:3000 开始游戏。

---

## 详细部署说明

### 方式一：开发模式（前后端分离）
```bash
npm install

# 终端 1 - 启动后端 (端口 3001)
npm run server

# 终端 2 - 启动前端 (端口 3000)
npm run dev
```

### 方式二：生产模式（单端口）
```bash
npm install
npm run build      # 构建前端
npm run server     # 启动生产服务器 (端口 3001)
```
访问 http://localhost:3001

### 方式三：Docker（可选）
```bash
docker build -t terminal-care .
docker run -p 3001:3001 -v $(pwd)/data:/app/data terminal-care
```

---

## 配置说明

复制 `.env.example` 为 `.env` 并填写：

```bash
# Gemini API Key（默认使用 Gemini）
GEMINI_API_KEY=your_gemini_api_key_here

# 或使用自定义 OpenAI 兼容 API（可选）
VITE_API_URL=https://api.openai.com/v1
VITE_CUSTOM_API_KEY=sk-xxx
VITE_CUSTOM_MODEL=gpt-4o
```

---

## 什么是 SillyTavern 预设？

SillyTavern 预设是文本生成参数的配置文件，包含：

- **温度 (Temperature)**: 控制输出的随机性 (0-2)
- **Top P**: 控制词汇选择的多样性 (0-1)
- **Top K**: 限制考虑的词数量
- **重复惩罚**: 防止模型重复相同的词
- **最大/最小 Token 数**: 控制生成长度
- **随机种子**: 固定输出以获得可重复的结果
- **系统提示词**: 覆盖默认的角色设定

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS
- **后端**: Express + SQLite (better-sqlite3)
- **AI**: Google Gemini API / OpenAI 兼容 API
- **部署**: 支持开发模式、生产模式、Docker

---

## 使用指南

### 创建新预设

1. 点击聊天界面顶部的 ⚙️ 按钮打开预设管理器
2. 点击 "+ 新建预设"
3. 调整参数：
   - **温度**: 越高越随机，越低越确定
   - **Top P**: 控制词汇多样性
   - **最大 Token 数**: 限制生成长度
   - **系统提示词**: 覆盖默认角色设定（可选）
4. 点击 "保存"

### 导入 SillyTavern 预设

1. 在预设管理器中点击 "📥 导入 SillyTavern 预设"
2. 拖放 JSON/YAML 文件或选择文件
3. 预设会自动导入并显示在列表中

### 导出预设

1. 在预设管理器中找到要导出的预设
2. 点击 "导出" 按钮
3. 下载为 SillyTavern 兼容的 JSON 文件

### 在会话中使用预设

**方法 1**: 创建新会话时选择预设
1. 打开会话侧边栏 (☰)
2. 点击 "+ 新会话"
3. 选择要使用的预设
4. 点击 "创建"

**方法 2**: 为现有会话设置预设
1. 打开预设管理器 (⚙️)
2. 找到要使用的预设
3. 点击 "应用" 按钮

**方法 3**: 设置全局默认预设
1. 打开预设管理器
2. 找到要设为默认的预设
3. 点击 "设为默认" 按钮

## API 端点

### 聊天会话
- `POST /api/chat/sessions` - 创建新会话
- `GET /api/chat/sessions` - 获取所有会话
- `GET /api/chat/sessions/:id` - 获取特定会话
- `PATCH /api/chat/sessions/:id` - 更新会话（包括预设）
- `GET /api/chat/sessions/:id/messages` - 获取会话消息
- `POST /api/chat/sessions/:id/messages` - 添加消息

### 预设 (SillyTavern 格式)
- `GET /api/presets` - 获取所有预设
- `GET /api/presets/active` - 获取当前激活的预设
- `POST /api/presets/active` - 设置激活预设
- `GET /api/presets/:id` - 获取特定预设
- `POST /api/presets` - 创建新预设
- `POST /api/presets/import/json` - 从 JSON 导入预设
- `POST /api/presets/upload` - 上传预设文件
- `GET /api/presets/:id/export` - 导出预设为 SillyTavern 格式
- `PATCH /api/presets/:id` - 更新预设
- `DELETE /api/presets/:id` - 删除预设

## SillyTavern 预设格式示例

```json
{
  "name": "Creative Writing",
  "temperature": 0.9,
  "top_p": 0.95,
  "top_k": 50,
  "top_a": 0,
  "typical_p": 1.0,
  "tfs": 1.0,
  "repetition_penalty": 1.1,
  "repetition_penalty_range": 1024,
  "min_tokens": 50,
  "max_tokens": 1024,
  "max_context_length": 4096,
  "epsilon_cutoff": 0,
  "eta_cutoff": 0,
  "seed": -1,
  "system_prompt": "你是一个富有创造力的作家..."
}
```

## 项目结构

```
.
├── server/              # 后端代码
│   ├── database.ts      # SQLite 数据库配置
│   ├── index.ts         # 服务器入口
│   ├── models/          # 数据模型
│   │   ├── chat.ts      # 聊天会话和消息
│   │   └── preset.ts    # SillyTavern 预设
│   └── routes/          # API 路由
│       ├── chat.ts
│       └── presets.ts
├── src/
│   ├── components/      # React 组件
│   │   ├── ChatAppWithPersistence.tsx
│   │   ├── PresetManager.tsx      # 预设管理界面
│   │   ├── PresetImporter.tsx     # 预设导入界面
│   │   └── SessionManager.tsx
│   ├── hooks/           # 自定义 Hooks
│   │   ├── useLLM.ts              # LLM 交互
│   │   └── usePersistentChat.ts   # 持久化聊天和预设
│   └── services/
│       └── api.ts       # API 客户端
├── data/                # SQLite 数据库（自动创建）
└── public/uploads/      # 上传的文件
```

## 与 SillyTavern 的兼容性

本项目支持导入 SillyTavern 导出的预设文件，包括：

- JSON 格式预设
- YAML 格式预设
- 所有标准生成参数
- 系统提示词覆盖

导出的预设文件可以直接在 SillyTavern 中使用。

## 许可证

MIT
