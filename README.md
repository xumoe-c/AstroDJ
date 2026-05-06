# 🎵 AstroDJ - 星链电台·信号修复系统

一个创新的混合模式音乐游戏，融合了 osu!standard、osu!mania 和 taiko 三种玩法。

![AstroDJ](frontend/src/assets/hero.png)

## ✨ 特性

### 🎮 游戏特性

- **混合模式玩法** - 在同一首歌中同时操作三种模式
- **高精度判定** - 支持最高 300Hz 刷新率
- **自动演奏** - 内置 AI 自动演奏功能
- **实时反馈** - ACC 指示器、连击数、准确率显示
- **动态难度** - 支持多段落、多难度切换

### 🎨 视觉效果

- **星空主题** - 赛博朋克风格的 UI 设计
- **动态背景** - 根据谱面自动切换背景
- **打击特效** - 华丽的判定反馈动画
- **模式指示** - 清晰的三模式状态显示

### 🛠️ 制谱工具

- **可视化编辑器** - 直观的谱面编辑界面
- **OSZ 导入** - 支持导入 osu! 谱面
- **自动转换** - osu!mania 4K 和 taiko 自动转换
- **实时预览** - 边编辑边预览效果
- **一键导出** - 导出为标准谱面包

### 💾 本地存储

- **IndexedDB 存储** - 纯前端本地存储
- **拖拽上传** - 简单直观的上传方式
- **谱面管理** - 增删查改完整功能
- **快速加载** - 无需网络，即时游玩

## 🚀 快速开始

### 方式 1：一键启动（推荐）

**Windows:**
```bash
cd frontend
dev.bat
```

**Linux/Mac:**
```bash
cd frontend
chmod +x dev.sh
./dev.sh
```

访问 `http://localhost:5173`

### 方式 2：手动启动

```bash
# 1. 构建 WASM
cd backend
./build.bat  # Windows
./build.sh   # Linux/Mac

# 2. 安装依赖
cd ../frontend
npm install

# 3. 启动开发服务器
npm run dev
```

详细说明请查看 [快速开始指南](./QUICK_START.md)

## 📦 部署

### Vercel 一键部署

**Windows:**
```bash
cd frontend
deploy-vercel.bat
```

**Linux/Mac:**
```bash
cd frontend
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

### 其他部署方式

- Netlify
- GitHub Pages
- Cloudflare Pages
- Docker
- 传统服务器

详细说明请查看 [部署指南](./DEPLOYMENT_GUIDE.md)

## 🎮 游戏操作

### 基本操作

| 操作 | 按键 |
|------|------|
| 开始/暂停 | 空格 |
| 自动演奏 | Tab |
| 调整速度 | F3/F4 |
| 调试信息 | ` |
| 返回首页 | Esc |

### 模式操作

**Mania (4K):**
- 按键：D, F, J, K

**Taiko:**
- Don（红）：F, J
- Ka（蓝）：D, K

**Osu-Standard:**
- 点击：鼠标左键/右键
- 移动：鼠标

## 📁 项目结构

```
astrodj/
├── backend/                    # Go 后端（WASM）
│   ├── cmd/convert/           # 谱面转换工具
│   ├── judge/                 # 判定规则
│   ├── osuconv/               # osu! 转换
│   ├── validator/             # 谱面验证
│   ├── main.go                # WASM 主程序
│   ├── build.bat              # Windows 构建脚本
│   └── build.sh               # Linux/Mac 构建脚本
│
├── frontend/                   # Vue 3 前端
│   ├── public/
│   │   ├── charts/            # 公共谱面
│   │   └── wasm/              # WASM 文件
│   ├── src/
│   │   ├── components/        # Vue 组件
│   │   ├── editor/            # 制谱器
│   │   ├── game/              # 游戏引擎
│   │   ├── services/          # 服务（IndexedDB）
│   │   ├── views/             # 页面
│   │   └── router/            # 路由
│   ├── dev.bat                # 开发启动脚本
│   ├── deploy-vercel.bat      # 部署脚本
│   ├── vercel.json            # Vercel 配置
│   └── netlify.toml           # Netlify 配置
│
├── QUICK_START.md             # 快速开始指南
├── DEPLOYMENT_GUIDE.md        # 部署指南
└── README.md                  # 本文件
```

## 🛠️ 技术栈

### 前端

- **框架**: Vue 3 + TypeScript
- **构建**: Vite
- **路由**: Vue Router
- **状态**: Pinia
- **存储**: IndexedDB
- **打包**: JSZip

### 后端

- **语言**: Go 1.21+
- **编译**: WASM
- **功能**: 判定引擎、谱面验证

### 游戏引擎

- **渲染**: Canvas 2D
- **音频**: Web Audio API
- **输入**: Keyboard + Mouse + Touch
- **时间轴**: 自定义时间轴系统

## 📚 文档

### 用户文档

- [快速开始指南](./QUICK_START.md)
- [谱面上传指南](./frontend/UPLOAD_QUICK_START.md)
- [自动演奏功能](./frontend/AUTO_PLAY.md)

### 开发文档

- [部署指南](./DEPLOYMENT_GUIDE.md)
- [IndexedDB 存储系统](./frontend/INDEXEDDB_STORAGE.md)
- [谱面上传方案](./frontend/CHART_UPLOAD_SOLUTIONS.md)
- [迁移指南](./frontend/MIGRATION_GUIDE.md)

### 技术文档

- [皮肤系统](./frontend/SKIN_SYSTEM.md)
- [实现总结](./frontend/INDEXEDDB_IMPLEMENTATION_SUMMARY.md)

## 🎯 功能清单

### ✅ 已实现

- [x] 三模式混合玩法
- [x] 高精度判定系统
- [x] 自动演奏功能
- [x] 可视化制谱器
- [x] OSZ 文件导入
- [x] 本地谱面存储
- [x] 拖拽上传
- [x] 谱面管理
- [x] 实时反馈显示
- [x] 动态难度切换
- [x] 封面和背景支持
- [x] 完整的文档

### 🚧 计划中

- [ ] 在线排行榜
- [ ] 多人对战模式
- [ ] 谱面分享社区
- [ ] 云端同步
- [ ] 更多皮肤主题
- [ ] 回放系统
- [ ] 成就系统

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- TypeScript 严格模式
- ESLint + Prettier
- 组件化设计
- 完整的类型定义

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [osu!](https://osu.ppy.sh/) - 灵感来源
- [Vue.js](https://vuejs.org/) - 前端框架
- [Go](https://golang.org/) - 后端语言
- [Vite](https://vitejs.dev/) - 构建工具

## 📞 联系方式

- 问题反馈：[GitHub Issues](https://github.com/yourusername/astrodj/issues)
- 功能建议：[GitHub Discussions](https://github.com/yourusername/astrodj/discussions)

## 🌟 Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**开始你的星链电台之旅！** 🎵🚀
