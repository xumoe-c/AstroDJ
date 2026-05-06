# 🎵 AstroDJ 游戏说明

## 游戏简介

AstroDJ 是一款基于 WebAssembly 的 4K 下落式音乐节奏游戏，兼容 osu!mania 谱面格式。音符从屏幕上方下落，在到达判定线时按下对应按键即可得分。

## 操作方式

### 键位绑定

游戏使用 4 个按键，对应 4 条轨道：

| 按键 | 轨道 | 位置 |
|------|------|------|
| **D** | 第 1 轨 | 左外侧（白色） |
| **F** | 第 2 轨 | 左内侧（蓝色） |
| **J** | 第 3 轨 | 右内侧（蓝色） |
| **K** | 第 4 轨 | 右外侧（白色） |

### 基本操作

- **普通音符（Note）**：音符到达判定线时，按下对应按键
- **长条音符（LN）**：音符头部到达判定线时按住按键，尾部到达时松开

## 游戏流程

1. **选歌页面** — 从列表中选择一首曲目
2. **点击开始** — 必须点击「点击开始」按钮才能播放音频（浏览器安全策略要求）
3. **Lead-in** — 开始后有 1.5 秒的准备时间，音符随后开始下落
4. **游玩** — 跟随节奏按键，屏幕右上角实时显示 Combo 和 Accuracy
5. **结算** — 所有音符处理完毕后自动跳转结算页面

## 判定系统

按键精度从高到低分为 6 个等级：

| 判定 | 精度窗口 | 说明 |
|------|----------|------|
| **300g** (MAX) | ±16ms | 完美命中 |
| **300** | ±(64 - 3×OD)ms | 极好 |
| **200** | ±(97 - 3×OD)ms | 很好 |
| **100** | ±(127 - 3×OD)ms | 还行 |
| **50** | ±(151 - 3×OD)ms | 勉强 |
| **Miss** | >188ms | 未命中 |

> OD（Overall Difficulty）为谱面难度参数，OD 越高判定窗口越严格。

## 计分规则

### Combo

- 获得 Miss 以外的判定时，Combo +1
- Miss 时 Combo 归零
- 结算页面显示最大 Combo

### Accuracy（准确率）

$$\text{Accuracy} = \frac{300g \times 305 + 300 \times 300 + 200 \times 200 + 100 \times 100 + 50 \times 50}{\text{总 Notes} \times 305}$$

### 评级

| 评级 | 准确率 |
|------|--------|
| SS | 100% |
| S | ≥ 95% |
| A | ≥ 90% |
| B | ≥ 80% |
| C | ≥ 70% |
| D | < 70% |

## 添加谱面

1. 准备一个 osu!mania **4K** 谱面（`.osu` 文件 + 对应音频 `.mp3`）
2. 在 `frontend/public/maps/` 下创建一个文件夹（如 `my-song`）
3. 将 `.osu` 文件重命名为 `beatmap.osu`，与 `.mp3` 一起放入该文件夹
4. 编辑 `frontend/public/maps/index.json`，将文件夹名加入数组

```
maps/
  index.json          ← ["shelter", "my-song"]
  shelter/
    beatmap.osu
    shelter.mp3
  my-song/
    beatmap.osu
    audio.mp3
```

> 注意：仅支持 CircleSize = 4（4K）的谱面，其他键数会报错。

## 技术信息

- 渲染：Canvas 2D，60fps
- 音频：Web Audio API（高精度时间同步）
- 判定引擎：Go → WebAssembly
- 前端框架：Vue 3 + TypeScript
