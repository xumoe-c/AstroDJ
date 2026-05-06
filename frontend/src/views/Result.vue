<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconTarget from '../components/icons/IconTarget.vue'
import IconStar from '../components/icons/IconStar.vue'
import IconZap from '../components/icons/IconZap.vue'
import IconRefresh from '../components/icons/IconRefresh.vue'
import IconHome from '../components/icons/IconHome.vue'

const route = useRoute()
const router = useRouter()

const JUDGE_LABELS = ['CRITICAL', 'PERFECT', 'GREAT', 'GOOD', 'MISS']
const JUDGE_KEYS = ['criticalPerfect', 'perfect', 'great', 'good', 'miss']
const JUDGE_COLORS = ['#00ffff', '#ffdd00', '#88ff44', '#44ddff', '#ff4444']

const counts = computed(() =>
  JUDGE_KEYS.map((k) => Number(route.query[k]) || 0),
)

const totalScore = computed(() => Number(route.query.score) || 0)
const maxCombo = computed(() => Number(route.query.maxCombo) || 0)
const accuracy = computed(() => Number(route.query.accuracy) || 0)
const totalNotes = computed(() => counts.value.reduce((a, b) => a + b, 0))
const rankLabel = computed(() => rank())
const accuracyText = computed(() => `${accuracy.value.toFixed(2)}%`)
const scoreText = computed(() => totalScore.value.toLocaleString('en-US'))

const osuAcc = computed(() => Number(route.query.osuAcc) || 0)
const maniaAcc = computed(() => Number(route.query.maniaAcc) || 0)
const taikoAcc = computed(() => Number(route.query.taikoAcc) || 0)
const judgeRows = computed(() =>
  JUDGE_LABELS.map((label, i) => {
    const count = counts.value[i]
    const ratio = totalNotes.value > 0 ? (count / totalNotes.value) * 100 : 0
    return {
      label,
      count,
      color: JUDGE_COLORS[i],
      ratio: `${Math.max(2, ratio).toFixed(1)}%`,
    }
  }),
)

function rank(): string {
  const acc = accuracy.value
  if (acc >= 100) return 'SS'
  if (acc >= 95) return 'S'
  if (acc >= 90) return 'A'
  if (acc >= 80) return 'B'
  if (acc >= 70) return 'C'
  return 'D'
}

function getMissionStatus(): string {
  const r = rankLabel.value
  if (r === 'SS' || r === 'S') return '完美修复'
  if (r === 'A') return '修复成功'
  if (r === 'B') return '基本修复'
  if (r === 'C') return '部分修复'
  return '修复失败'
}
</script>

<template>
  <div class="result-view">
    <!-- 星空背景 -->
    <div class="starfield"></div>
    
    <!-- 发光装饰 -->
    <div class="glow glow-left"></div>
    <div class="glow glow-right"></div>

    <!-- 主面板 - 左右分栏 -->
    <section class="result-panel">
      <!-- 左侧：评级和成就 -->
      <aside class="left-section">
        <!-- 评级 -->
        <div class="rank-container">
          <p class="caption">任务完成</p>
          <h1 class="rank" :class="`rank-${rankLabel.toLowerCase()}`">
            {{ rankLabel }}
          </h1>
          <div class="rank-glow" :class="`glow-${rankLabel.toLowerCase()}`"></div>
        </div>

        <!-- 任务状态 -->
        <div class="mission-status">
          <span class="status-badge" :class="rankLabel.toLowerCase()">
            {{ getMissionStatus() }}
          </span>
        </div>

        <!-- 核心数据卡片 -->
        <div class="stats-cards">
          <article class="stat-card stat-score">
            <div class="stat-icon">
              <IconTarget />
            </div>
            <div class="stat-content">
              <p class="stat-label">总分</p>
              <p class="stat-value">{{ scoreText }}</p>
            </div>
            <div class="stat-bg"></div>
          </article>

          <article class="stat-card stat-acc">
            <div class="stat-icon">
              <IconStar />
            </div>
            <div class="stat-content">
              <p class="stat-label">准确率</p>
              <p class="stat-value">{{ accuracyText }}</p>
            </div>
            <div class="stat-bg"></div>
          </article>

          <article class="stat-card stat-combo">
            <div class="stat-icon">
              <IconZap />
            </div>
            <div class="stat-content">
              <p class="stat-label">最高连击</p>
              <p class="stat-value">{{ maxCombo }}x</p>
            </div>
            <div class="stat-bg"></div>
          </article>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button class="retry-btn" @click="router.push('/')">
            <IconRefresh class="btn-icon" />
            <span>重新挑战</span>
          </button>
          <button class="back-btn" @click="router.push('/')">
            <IconHome class="btn-icon" />
            <span>返回选曲</span>
          </button>
        </div>
      </aside>

      <!-- 右侧：判定详情 -->
      <main class="right-section">
        <div class="details-header">
          <h3 class="section-title">判定详情</h3>
          <div class="total-notes">
            <span class="footer-label">总音符数</span>
            <strong class="footer-value">{{ totalNotes }}</strong>
          </div>
        </div>

        <div class="judge-grid">
          <div
            v-for="row in judgeRows"
            :key="row.label"
            class="judge-row"
          >
            <div class="judge-header">
              <span class="judge-label" :style="{ color: row.color }">
                {{ row.label }}
              </span>
              <span class="judge-count">{{ row.count }}</span>
            </div>
            <div class="judge-bar-container">
              <div 
                class="judge-bar" 
                :style="{ 
                  width: row.ratio, 
                  background: `linear-gradient(90deg, ${row.color}, ${row.color}88)`,
                  boxShadow: `0 0 10px ${row.color}66`
                }" 
              />
            </div>
          </div>
        </div>
      </main>
    </section>
  </div>
</template>

<style scoped>
.result-view {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--astro-bg-gradient);
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

/* 星空背景 */
.starfield {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.8), transparent),
    radial-gradient(2px 2px at 80% 70%, rgba(0,217,255,0.6), transparent),
    radial-gradient(1px 1px at 50% 50%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 70% 20%, rgba(107,76,230,0.5), transparent),
    radial-gradient(2px 2px at 30% 80%, rgba(255,255,255,0.7), transparent);
  background-size: 300% 300%;
  animation: starfield 180s linear infinite;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

/* 发光装饰 */
.glow {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}

.glow-left {
  left: -150px;
  top: -150px;
  background: var(--astro-nebula-purple);
}

.glow-right {
  right: -150px;
  bottom: -150px;
  background: var(--astro-plasma-cyan);
}

/* 主面板 - 左右分栏 */
.result-panel {
  position: relative;
  z-index: 1;
  width: min(1400px, 95%);
  max-height: 90vh;
  background: var(--astro-panel-bg);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(107, 76, 230, 0.3);
  border-radius: 24px;
  padding: 32px;
  box-shadow: var(--astro-glow-purple), 0 20px 60px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.6s ease-out;
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 32px;
  overflow: hidden;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 左侧：评级和成就 */
.left-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-right: 16px;
  border-right: 1px solid rgba(107, 76, 230, 0.2);
}

/* 右侧：判定详情 */
.right-section {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-right: 8px;
}

.right-section::-webkit-scrollbar {
  width: 6px;
}

.right-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.right-section::-webkit-scrollbar-thumb {
  background: var(--astro-nebula-purple);
  border-radius: 3px;
}

/* 评级区域 */
.rank-container {
  text-align: center;
  position: relative;
  padding: 20px 0;
}

.caption {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: var(--astro-plasma-cyan);
  letter-spacing: 3px;
  text-transform: uppercase;
  opacity: 0.8;
}

.rank {
  margin: 0;
  font-size: clamp(4rem, 10vw, 6rem);
  font-weight: 900;
  letter-spacing: 0.05em;
  line-height: 1;
  text-shadow: 0 0 30px currentColor, 0 8px 24px rgba(0, 0, 0, 0.7);
  position: relative;
  z-index: 1;
}

.rank-glow {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.4;
  z-index: 0;
  animation: pulse-glow 2s ease-in-out infinite;
}

.rank-ss, .rank-s {
  color: #ffd700;
}

.rank-a {
  color: #00ff88;
}

.rank-b {
  color: #00d9ff;
}

.rank-c {
  color: #ff8c42;
}

.rank-d {
  color: #ff4466;
}

.glow-ss, .glow-s {
  background: #ffd700;
}

.glow-a {
  background: #00ff88;
}

.glow-b {
  background: #00d9ff;
}

.glow-c {
  background: #ff8c42;
}

.glow-d {
  background: #ff4466;
}

/* 任务状态 */
.mission-status {
  text-align: center;
  margin-bottom: 8px;
}

.status-badge {
  display: inline-block;
  padding: 10px 24px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 1px;
  text-transform: uppercase;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.status-badge.ss, .status-badge.s {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #1a1535;
}

.status-badge.a {
  background: linear-gradient(135deg, #00ff88, #00d9ff);
  color: #0a0e1a;
}

.status-badge.b {
  background: linear-gradient(135deg, #00d9ff, #6b4ce6);
  color: white;
}

.status-badge.c {
  background: linear-gradient(135deg, #ff8c42, #ffd700);
  color: #1a1535;
}

.status-badge.d {
  background: linear-gradient(135deg, #ff4466, #ff8c42);
  color: white;
}

/* 数据卡片 */
.stats-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(107, 76, 230, 0.3);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateX(4px);
  border-color: var(--astro-plasma-cyan);
  box-shadow: var(--astro-glow-cyan);
}

.stat-bg {
  position: absolute;
  inset: 0;
  opacity: 0.1;
  z-index: 0;
}

.stat-score .stat-bg {
  background: linear-gradient(135deg, var(--astro-nebula-purple), transparent);
}

.stat-acc .stat-bg {
  background: linear-gradient(135deg, #ffd700, transparent);
}

.stat-combo .stat-bg {
  background: linear-gradient(135deg, var(--astro-signal-green), transparent);
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(107, 76, 230, 0.2), rgba(0, 217, 255, 0.2));
  border-radius: 12px;
  position: relative;
  z-index: 1;
  color: var(--astro-plasma-cyan);
  flex-shrink: 0;
}

.stat-icon svg {
  width: 28px;
  height: 28px;
}

.stat-content {
  flex: 1;
  position: relative;
  z-index: 1;
}

.stat-label {
  margin: 0 0 4px 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--astro-star-white);
  font-family: 'Consolas', monospace;
}

/* 判定详情 */
.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(107, 76, 230, 0.2);
}

.section-title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--astro-star-white);
  font-weight: 600;
}

.total-notes {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(20, 25, 45, 0.6);
  border-radius: 20px;
  border: 1px solid rgba(107, 76, 230, 0.2);
}

.footer-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.footer-value {
  color: var(--astro-star-white);
  font-size: 1.2rem;
  font-weight: 700;
  font-family: 'Consolas', monospace;
}

.judge-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.judge-row {
  padding: 16px 18px;
  background: rgba(20, 25, 45, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(107, 76, 230, 0.2);
  transition: all 0.3s ease;
}

.judge-row:hover {
  background: rgba(30, 35, 60, 0.7);
  border-color: rgba(107, 76, 230, 0.4);
  transform: translateX(4px);
}

.judge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.judge-label {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 1px;
  text-shadow: 0 0 10px currentColor;
}

.judge-count {
  color: var(--astro-star-white);
  font-weight: 700;
  font-size: 1.2rem;
  font-family: 'Consolas', monospace;
}

.judge-bar-container {
  height: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 5px;
  overflow: hidden;
}

.judge-bar {
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s ease-out;
  animation: barGrow 0.8s ease-out;
}

@keyframes barGrow {
  from {
    width: 0 !important;
  }
}

/* 操作按钮 */
.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: auto;
}

.retry-btn, .back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  font-size: 0.95rem;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.5px;
}

.retry-btn {
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  color: white;
  box-shadow: var(--astro-glow-purple);
}

.retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(107, 76, 230, 0.8);
}

.back-btn {
  background: rgba(30, 35, 60, 0.6);
  color: var(--astro-plasma-cyan);
  border: 1px solid rgba(0, 217, 255, 0.3);
}

.back-btn:hover {
  background: rgba(30, 35, 60, 0.9);
  border-color: var(--astro-plasma-cyan);
  box-shadow: var(--astro-glow-cyan);
}

.btn-icon {
  width: 18px;
  height: 18px;
}

/* 响应式 - 平板 */
@media (max-width: 1200px) {
  .result-panel {
    grid-template-columns: 350px 1fr;
    gap: 24px;
    padding: 28px;
  }

  .rank {
    font-size: clamp(3.5rem, 9vw, 5rem);
  }

  .stat-value {
    font-size: 1.3rem;
  }
}

@media (max-width: 1024px) {
  .result-panel {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 24px;
    max-height: none;
  }

  .left-section {
    border-right: none;
    border-bottom: 1px solid rgba(107, 76, 230, 0.2);
    padding-right: 0;
    padding-bottom: 24px;
  }

  .right-section {
    overflow-y: visible;
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-card {
    flex-direction: column;
    text-align: center;
    padding: 14px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }

  .stat-icon svg {
    width: 24px;
    height: 24px;
  }

  .stat-value {
    font-size: 1.2rem;
  }
}

/* 响应式 - 手机横屏 */
@media (max-width: 768px) and (orientation: landscape) {
  .result-view {
    padding: 16px 12px;
  }

  .result-panel {
    padding: 20px;
    gap: 20px;
    max-height: 88vh;
    overflow-y: auto;
  }

  .result-panel::-webkit-scrollbar {
    width: 6px;
  }

  .result-panel::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }

  .result-panel::-webkit-scrollbar-thumb {
    background: var(--astro-nebula-purple);
    border-radius: 3px;
  }

  .left-section {
    gap: 16px;
    padding-bottom: 20px;
  }

  .rank-container {
    padding: 12px 0;
  }

  .caption {
    font-size: 0.75rem;
    margin-bottom: 4px;
  }

  .rank {
    font-size: clamp(2.5rem, 8vw, 3.5rem);
  }

  .status-badge {
    padding: 8px 20px;
    font-size: 0.8rem;
  }

  .stats-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    flex-direction: row;
    padding: 12px;
    text-align: left;
  }

  .stat-icon {
    width: 44px;
    height: 44px;
  }

  .stat-icon svg {
    width: 22px;
    height: 22px;
  }

  .stat-label {
    font-size: 0.7rem;
  }

  .stat-value {
    font-size: 1.1rem;
  }

  .details-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .section-title {
    font-size: 1rem;
  }

  .total-notes {
    padding: 6px 12px;
  }

  .footer-label {
    font-size: 0.75rem;
  }

  .footer-value {
    font-size: 1rem;
  }

  .judge-grid {
    gap: 8px;
  }

  .judge-row {
    padding: 12px 14px;
  }

  .judge-label {
    font-size: 0.9rem;
  }

  .judge-count {
    font-size: 1rem;
  }

  .judge-bar-container {
    height: 8px;
  }

  .action-buttons {
    gap: 8px;
  }

  .retry-btn, .back-btn {
    padding: 12px 16px;
    font-size: 0.85rem;
  }

  .btn-icon {
    width: 16px;
    height: 16px;
  }
}

/* 响应式 - 手机竖屏 */
@media (max-width: 768px) and (orientation: portrait) {
  .result-view {
    filter: blur(3px);
  }

  .result-view::after {
    content: '请旋转设备至横屏模式';
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--astro-panel-bg);
    backdrop-filter: blur(10px);
    padding: 32px 40px;
    border-radius: 16px;
    border: 2px solid rgba(107, 76, 230, 0.5);
    color: var(--astro-star-white);
    font-size: 1.2rem;
    text-align: center;
    z-index: 9999;
    box-shadow: var(--astro-glow-purple);
    max-width: 80%;
    line-height: 1.8;
    font-weight: 500;
  }

  .result-panel {
    opacity: 0.3;
    pointer-events: none;
  }
}

/* 超小屏幕 */
@media (max-width: 480px) and (orientation: landscape) {
  .result-panel {
    padding: 16px;
    gap: 16px;
  }

  .rank {
    font-size: clamp(2rem, 7vw, 3rem);
  }

  .stats-cards {
    gap: 6px;
  }

  .stat-card {
    padding: 10px;
  }

  .judge-row {
    padding: 10px 12px;
  }

  .action-buttons {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

/* 超大屏幕优化 */
@media (min-width: 1920px) {
  .result-panel {
    width: min(1600px, 95%);
    grid-template-columns: 480px 1fr;
    gap: 48px;
    padding: 48px;
  }

  .left-section {
    gap: 32px;
    padding-right: 24px;
  }

  .rank {
    font-size: clamp(5rem, 10vw, 7rem);
  }

  .status-badge {
    padding: 12px 28px;
    font-size: 1.05rem;
  }

  .stat-card {
    padding: 20px;
  }

  .stat-icon {
    width: 64px;
    height: 64px;
  }

  .stat-icon svg {
    width: 32px;
    height: 32px;
  }

  .stat-value {
    font-size: 1.8rem;
  }

  .details-header {
    margin-bottom: 24px;
    padding-bottom: 20px;
  }

  .section-title {
    font-size: 1.4rem;
  }

  .total-notes {
    padding: 10px 20px;
  }

  .footer-value {
    font-size: 1.4rem;
  }

  .judge-grid {
    gap: 14px;
  }

  .judge-row {
    padding: 20px 22px;
  }

  .judge-label {
    font-size: 1.15rem;
  }

  .judge-count {
    font-size: 1.3rem;
  }

  .judge-bar-container {
    height: 12px;
  }

  .action-buttons {
    gap: 16px;
  }

  .retry-btn, .back-btn {
    padding: 18px 28px;
    font-size: 1.05rem;
  }

  .btn-icon {
    width: 22px;
    height: 22px;
  }
}
</style>
