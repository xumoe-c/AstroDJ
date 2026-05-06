# AstroDJ - 混合音游系统

<div align="center">

**基于 WebAssembly 的混合节奏游戏 | 支持三种游戏模式无缝切换**

[English](README.md) | 简体中文

</div>

---

## 📖 项目简介

AstroDJ 是一款创新的混合节奏游戏，允许在同一首歌曲中无缝切换三种不同的游戏模式：

- **Mania 模式** - 下落式轨道音游（类似 osu!mania）
- **Taiko 模式** - 太鼓打击音游（类似 osu!taiko）
- **Osu-Standard 模式** - 圆圈点击音游（类似 osu!standard）

### ✨ 核心特性

🎮 **混合模式玩法**
- 在同一谱面中体验多种游戏模式
- 提前 3 秒显示模式切换提示
- 自动保存分数和连击数

🎵 **完整 osu! 兼容**
- 支持导入 .osu 格式谱面
- 保留原始元数据和 timing 信息
- 支持导出回 .osu 格式

⚡ **高性能表现**
- 60 FPS 流畅运行
- 模式切换延迟 < 100ms
- 支持 1000+ 音符的大型谱面

🎯 **优化的判定系统**
- 更宽松的判定窗口（Mania: 200ms, Taiko: 120ms, Osu-Standard: 165ms）
- 音符锁定机制，防止重复判定和误触
- 智能优先级判定，准确处理密集音符模式
- 跨模式统一计分和实时准确率显示

---

## 🚀 快速开始

### 环境要求

- **Go 1.22+** (用于编译 WebAssembly)
- **Node.js 18+** (用于前端开发)
- **现代浏览器** (支持 WebAssembly 和 Web Audio API)

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/yourusername/AstroDJ.git
cd AstroDJ
```

#### 2. 编译 WebAssembly 模块

**Linux / macOS:**
```bash
cd backend
chmod +x build.sh
./build.sh
```

**Windows:**
```bash
cd backend
build.bat
```

编译完成后，`main.wasm` 和 `wasm_exec.js` 将自动复制到 `frontend/public/wasm/` 目录。

#### 3. 安装前端依赖

```bash
cd frontend
npm install
```

#### 4. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 http://localhost:5173 即可开始游玩！

---

## 🎮 游戏玩法

### Mania 模式 (4K)

下落式轨道音游，音符从上方落下，在判定线处按下对应按键。

**键位配置：**

| 按键 | 轨道 |
|------|------|
| D    | 轨道 1 |
| F    | 轨道 2 |
| J    | 轨道 3 |
| K    | 轨道 4 |

**判定窗口：**

| 判定 | 时间窗口 (ms) | 得分 |
|------|---------------|------|
| 300g (Perfect) | ±16 | 300 |
| 300 (Great) | ±(64 - 3×OD) | 300 |
| 200 (Good) | ±(97 - 3×OD) | 200 |
| 100 (Ok) | ±(127 - 3×OD) | 100 |
| 50 (Bad) | ±(151 - 3×OD) | 50 |
| Miss | >188 | 0 |

### Taiko 模式

太鼓打击音游，红色音符（Don）和蓝色音符（Ka）从右向左移动。

**键位配置：**

| 按键 | 音符类型 |
|------|----------|
| F, J | Don (红色) |
| D, K | Ka (蓝色) |

**判定窗口：**

| 判定 | 时间窗口 (ms) | 得分 |
|------|---------------|------|
| Great | ±50 | 300 |
| Good | ±120 | 150 |
| Ok | ±200 | 50 |
| Miss | >200 | 0 |

### Osu-Standard 模式

圆圈点击音游，使用鼠标或触摸屏点击圆圈、滑动滑条、旋转转盘。

**操作方式：**

- **鼠标/触摸屏**: 移动光标并点击
- **键盘 Z/X**: 辅助点击（配合鼠标移动）

**音符类型：**

- **Hit Circle (圆圈)**: 在正确时机点击
- **Slider (滑条)**: 点击起点后跟随滑条路径
- **Spinner (转盘)**: 快速旋转光标完成转盘

**判定窗口：**

| 判定 | 时间窗口 (ms) | 得分 |
|------|---------------|------|
| 300 (Perfect) | ±(80 - 6×OD) | 300 |
| 100 (Good) | ±(140 - 8×OD) | 100 |
| 50 (Ok) | ±(200 - 10×OD) | 50 |
| Miss | >200 | 0 |

---

## 📁 谱面管理

### 使用 osu! 谱面

#### 1. 准备谱面文件

将 osu! 谱面文件夹放入 `frontend/public/maps/` 目录：

```
frontend/public/maps/
├── index.json
├── my-song/
│   ├── beatmap.osu
│   └── audio.mp3
└── another-song/
    ├── beatmap.osu
    └── audio.mp3
```

#### 2. 更新索引文件

编辑 `frontend/public/maps/index.json`：

```json
[
  "my-song",
  "another-song"
]
```

#### 3. 支持的 osu! 模式

- **osu!mania**: 4K (CircleSize 4) 和 7K (CircleSize 7)
- **osu!taiko**: 太鼓模式
- **osu!standard**: 标准模式

### 使用混合谱面

#### 1. 创建混合谱面

在 `frontend/public/charts/` 目录创建谱面文件夹：

```
frontend/public/charts/
├── index.json
└── my-hybrid-chart/
    ├── chart.json
    └── song.mp3
```

#### 2. 混合谱面格式

`chart.json` 示例：

```json
{
  "meta": {
    "title": "混合谱面示例",
    "artist": "艺术家名称",
    "audio": "song.mp3",
    "length": 180000
  },
  "segments": [
    {
      "id": "mania-intro",
      "startMs": 0,
      "endMs": 60000,
      "mode": "mania",
      "judgeRule": "mania-od8",
      "config": {
        "keys": ["D", "F", "J", "K"],
        "scrollSpeed": 1.0
      },
      "notes": [
        { "lane": 0, "time": 1000 },
        { "lane": 1, "time": 1500 }
      ]
    },
    {
      "id": "taiko-middle",
      "startMs": 60000,
      "endMs": 120000,
      "mode": "taiko",
      "judgeRule": "taiko-normal",
      "config": {
        "donKeys": ["F", "J"],
        "kaKeys": ["D", "K"],
        "scrollSpeed": 0.8
      },
      "notes": [
        { "type": "don", "time": 61000 },
        { "type": "ka", "time": 62000 }
      ]
    },
    {
      "id": "osu-finale",
      "startMs": 120000,
      "endMs": 180000,
      "mode": "osu-standard",
      "judgeRule": "osu-od8",
      "config": {
        "circleSize": 4,
        "approachRate": 9,
        "scrollSpeed": 1.0
      },
      "notes": [
        { "type": "circle", "x": 256, "y": 192, "time": 121000 },
        {
          "type": "slider",
          "x": 300,
          "y": 200,
          "time": 125000,
          "endTime": 127000,
          "sliderPath": {
            "type": "L",
            "points": [
              { "x": 300, "y": 200 },
              { "x": 400, "y": 200 }
            ],
            "slides": 1,
            "length": 100
          }
        }
      ]
    }
  ]
}
```

#### 3. 更新索引文件

编辑 `frontend/public/charts/index.json`：

```json
[
  "demo",
  "my-hybrid-chart"
]
```

### 示例谱面

项目包含多个示例谱面，位于 `frontend/public/charts/test-fixtures/`：

- **simple-mania-taiko.json** - 基础双模式谱面
- **three-mode-hybrid.json** - 完整三模式展示
- **osu-import-example.json** - osu! 导入示例

---

## 🎨 模式切换提示

### 视觉提示系统

游戏会在模式切换前提供清晰的视觉提示：

**提前 3 秒：**
- 显示下一个模式的名称
- 显示模式专属颜色
  - Mania: 蓝色
  - Taiko: 红色
  - Osu-Standard: 粉色

**提前 1 秒：**
- 显示倒计时（精确到 0.1 秒）
- 显示下一个模式的键位配置

**切换时：**
- 自动保存当前分数和连击
- 未完成的音符判定为 Miss
- 如有 Miss 则重置连击数

---

## 🛠️ 开发指南

### 项目结构

```
AstroDJ/
├── backend/              # Go WebAssembly 后端
│   ├── cmd/             # 命令行工具
│   ├── judge/           # 判定逻辑
│   ├── osuconv/         # osu! 格式转换
│   ├── validator/       # 谱面验证
│   └── main.go          # WASM 入口
├── frontend/            # Vue 3 前端
│   ├── public/
│   │   ├── charts/      # 混合谱面
│   │   ├── maps/        # osu! 谱面
│   │   └── wasm/        # 编译后的 WASM
│   └── src/
│       ├── components/  # Vue 组件
│       ├── game/        # 游戏核心逻辑
│       │   ├── runtimes/    # 模式运行时
│       │   ├── audio.ts     # 音频引擎
│       │   ├── scorer.ts    # 计分系统
│       │   ├── timeline.ts  # 时间轴控制
│       │   ├── parser.ts    # 谱面解析
│       │   ├── validator.ts # 谱面验证
│       │   ├── formatter.ts # 谱面格式化
│       │   └── converter.ts # 格式转换
│       └── views/       # 页面视图
└── .kiro/
    └── specs/           # 功能规格文档
```

### 运行测试

```bash
cd frontend
npm run test
```

测试覆盖：
- ✅ 27 个 osu-standard 运行时测试
- ✅ 51 个运行时管理器测试
- ✅ 解析器、验证器、格式化器测试
- ✅ 计分系统测试

### 构建生产版本

```bash
cd frontend
npm run build
```

构建产物将输出到 `frontend/dist/` 目录。

### 性能基准

系统性能目标：

| 操作 | 目标性能 | 实际表现 |
|------|----------|----------|
| 谱面解析 | < 50ms | ✅ 达标 |
| 谱面验证 | < 10ms | ✅ 达标 |
| 谱面序列化 | < 30ms | ✅ 达标 |
| 模式切换延迟 | < 100ms | ✅ 达标 |
| 游戏帧率 | 60 FPS | ✅ 达标 |

---

## 📚 文档资源

### 核心文档

- **[混合谱面格式规范](frontend/src/game/HYBRID_CHART_FORMAT.md)** - 详细的谱面格式说明
- **[转换器使用指南](frontend/src/game/CONVERTER_USAGE.md)** - 格式转换工具文档
- **[测试谱面说明](frontend/public/charts/test-fixtures/README.md)** - 示例谱面介绍

### 规格文档

- **[需求文档](.kiro/specs/hybrid-rhythm-game/requirements.md)** - 功能需求定义
- **[设计文档](.kiro/specs/hybrid-rhythm-game/design.md)** - 系统设计方案
- **[任务列表](.kiro/specs/hybrid-rhythm-game/tasks.md)** - 开发任务追踪

---

## 🔧 技术栈

### 后端 (WebAssembly)

- **Go 1.22+** - 编译为 WebAssembly
- **判定引擎** - 高精度时间判定
- **谱面解析** - osu! 格式支持
- **数据验证** - 谱面合法性检查

### 前端

- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **Canvas 2D** - 游戏渲染
- **Web Audio API** - 音频播放

---

## 🎯 路线图

### 已完成 ✅

- [x] Mania 模式运行时
- [x] Taiko 模式运行时
- [x] Osu-Standard 模式运行时
- [x] 混合谱面解析器
- [x] 统一计分系统
- [x] 模式切换管理
- [x] 转换提示 UI
- [x] osu! 格式导入/导出
- [x] 性能优化

### 计划中 🚧

- [ ] 谱面编辑器 UI
- [ ] 在线谱面分享
- [ ] 多人对战模式
- [ ] 自定义皮肤系统
- [ ] 回放系统
- [ ] 排行榜功能

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 遵循 TypeScript 最佳实践
- 编写单元测试覆盖新功能
- 更新相关文档
- 保持代码风格一致

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- **osu!** - 灵感来源和谱面格式参考
- **Vue.js** - 优秀的前端框架
- **Go** - 强大的 WebAssembly 支持

---

## 📞 联系方式

- **问题反馈**: [GitHub Issues](https://github.com/yourusername/AstroDJ/issues)
- **讨论交流**: [GitHub Discussions](https://github.com/yourusername/AstroDJ/discussions)

---

<div align="center">

**享受混合音游的乐趣！** 🎵🎮

Made with ❤️ by AstroDJ Team

</div>
