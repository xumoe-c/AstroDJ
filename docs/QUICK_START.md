# AstroDJ 快速开始指南

## 🚀 5 分钟快速启动

### Windows 用户

```bash
# 1. 进入前端目录
cd frontend

# 2. 运行开发脚本（自动构建 WASM + 安装依赖 + 启动服务器）
dev.bat
```

### Linux/Mac 用户

```bash
# 1. 进入前端目录
cd frontend

# 2. 添加执行权限
chmod +x dev.sh

# 3. 运行开发脚本
./dev.sh
```

访问 `http://localhost:5173` 即可开始使用！

## 📦 手动启动（如果脚本失败）

### 步骤 1：构建 WASM

**Windows:**
```bash
cd backend
build.bat
```

**Linux/Mac:**
```bash
cd backend
chmod +x build.sh
./build.sh
```

### 步骤 2：安装前端依赖

```bash
cd frontend
npm install
```

### 步骤 3：启动开发服务器

```bash
npm run dev
```

## 🌐 部署到生产环境

### 最简单的方式：Vercel

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

首次部署需要：
1. 安装 Vercel CLI: `npm install -g vercel`
2. 登录 Vercel: `vercel login`

### 其他部署方式

查看完整的 [部署指南](./DEPLOYMENT_GUIDE.md)

## 🎮 使用指南

### 1. 游玩现有谱面

1. 打开首页
2. 点击任意谱面卡片
3. 等待加载完成
4. 按空格键开始游戏

### 2. 上传自己的谱面

**方式 A：拖拽上传**
1. 准备好 `.zip` 谱面包
2. 拖拽到首页任意位置
3. 等待上传完成
4. 点击游玩

**方式 B：按钮上传**
1. 点击"上传谱面"按钮
2. 选择 `.zip` 文件
3. 等待上传完成
4. 点击游玩

### 3. 制作谱面

1. 点击"制谱器"按钮
2. 导入 `.osz` 文件（osu! 谱面）
3. 编辑和调整
4. 导出为 `.zip`
5. 返回首页上传

## 🎹 游戏操作

### Mania 模式
- 按键：D, F, J, K（4K）

### Taiko 模式
- Don（红）：F, J
- Ka（蓝）：D, K

### Osu-Standard 模式
- 点击：鼠标左键/右键
- 移动：鼠标

### 通用操作
- **空格**：开始/暂停
- **Tab**：切换自动演奏
- **F3/F4**：调整滚动速度
- **`**：显示调试信息
- **Esc**：返回首页

## 🔧 常见问题

### Q: 启动失败怎么办？

**检查环境：**
```bash
node --version  # 需要 18.x+
npm --version   # 需要 9.x+
go version      # 需要 1.21+
```

**清除缓存重试：**
```bash
cd frontend
rm -rf node_modules
rm package-lock.json
npm install
```

### Q: WASM 加载失败？

**确保 WASM 文件存在：**
```bash
# 应该存在这两个文件
frontend/public/wasm/main.wasm
frontend/public/wasm/wasm_exec.js
```

**重新构建 WASM：**
```bash
cd backend
./build.bat  # Windows
./build.sh   # Linux/Mac
```

### Q: 谱面无法上传？

**检查文件格式：**
- 必须是 `.zip` 格式
- ZIP 包中必须包含 `chart.json`
- 音频文件必须存在

**检查浏览器：**
- 使用现代浏览器（Chrome/Edge/Firefox）
- 不要使用隐私模式
- 检查存储空间

### Q: 音频无法播放？

**常见原因：**
1. 音频格式不支持（推荐 MP3）
2. 文件路径错误
3. 浏览器自动播放限制（需要用户交互）

**解决方案：**
- 转换音频为 MP3 格式
- 检查 `chart.json` 中的 `audio` 字段
- 点击页面后再开始游戏

## 📚 更多文档

- [完整部署指南](./DEPLOYMENT_GUIDE.md)
- [IndexedDB 存储系统](./frontend/INDEXEDDB_STORAGE.md)
- [谱面上传指南](./frontend/UPLOAD_QUICK_START.md)
- [自动演奏功能](./frontend/AUTO_PLAY.md)

## 🎉 开始游玩！

现在你已经准备好了！

1. ✅ 启动开发服务器
2. ✅ 访问 http://localhost:5173
3. ✅ 选择谱面开始游玩
4. ✅ 上传自己的谱面
5. ✅ 制作新的谱面

享受 AstroDJ 带来的乐趣！🎵🎮
