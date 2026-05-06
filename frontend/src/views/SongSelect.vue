<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { convertOsuToChart } from '../game/osu-convert'
import { calculateDuration, extractBPM, calculateModeDistribution, loadBestRank, type Rank, type ModeDistribution } from '../game/chart-metadata'
import type { Chart } from '../game/types'
import { chartStorage, type StoredChart } from '../services/chart-storage'
import IconEdit from '../components/icons/IconEdit.vue'
import IconPlay from '../components/icons/IconPlay.vue'
import IconFolder from '../components/icons/IconFolder.vue'
import IconMusic from '../components/icons/IconMusic.vue'
import IconGamepad from '../components/icons/IconGamepad.vue'
import IconZap from '../components/icons/IconZap.vue'
import IconAlert from '../components/icons/IconAlert.vue'

interface ChartMetadata {
  name: string
  duration: number
  bpm: number | null
  stars: number
  modeDistribution: ModeDistribution
  bestRank: Rank | null
  source: 'public' | 'user'
  uploadedAt?: number
}

const router = useRouter()
const publicMaps = ref<string[]>([])
const userCharts = ref<StoredChart[]>([])
const chartsMetadata = ref<Map<string, ChartMetadata>>(new Map())
const loading = ref(true)
const error = ref('')
const dragOver = ref(false)
const uploadInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadProgress = ref('')

// Computed: all charts combined
const allCharts = computed(() => {
  const charts: Array<{ id: string; metadata: ChartMetadata }> = []
  
  // Add public charts
  publicMaps.value.forEach(name => {
    const meta = chartsMetadata.value.get(name)
    if (meta) {
      charts.push({ id: name, metadata: meta })
    }
  })
  
  // Add user charts
  userCharts.value.forEach(chart => {
    const meta = chartsMetadata.value.get(chart.id)
    if (meta) {
      charts.push({ id: chart.id, metadata: meta })
    }
  })
  
  // Sort by upload time (user charts first) then by name
  return charts.sort((a, b) => {
    if (a.metadata.source !== b.metadata.source) {
      return a.metadata.source === 'user' ? -1 : 1
    }
    if (a.metadata.uploadedAt && b.metadata.uploadedAt) {
      return b.metadata.uploadedAt - a.metadata.uploadedAt
    }
    return a.metadata.name.localeCompare(b.metadata.name)
  })
})

onMounted(async () => {
  try {
    // Load public charts
    const res = await fetch('/charts/index.json')
    if (!res.ok) throw new Error('Failed to load chart index')
    publicMaps.value = await res.json()
    
    // Load metadata for public charts
    for (const name of publicMaps.value) {
      try {
        const chartRes = await fetch(`/charts/${name}/chart.json`)
        if (chartRes.ok) {
          const chart: Chart = await chartRes.json()
          chartsMetadata.value.set(name, {
            name,
            duration: calculateDuration(chart),
            bpm: extractBPM(chart),
            stars: 4.5, // Placeholder for MVP
            modeDistribution: calculateModeDistribution(chart),
            bestRank: loadBestRank(name),
            source: 'public'
          })
        }
      } catch (e) {
        console.warn(`Failed to load metadata for ${name}:`, e)
      }
    }

    // Load user-uploaded charts from IndexedDB
    await loadUserCharts()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function loadUserCharts() {
  try {
    userCharts.value = await chartStorage.listCharts()
    
    // Add metadata for user charts
    for (const chart of userCharts.value) {
      chartsMetadata.value.set(chart.id, {
        name: chart.name,
        duration: chart.metadata.duration,
        bpm: chart.metadata.bpm ?? null,
        stars: 4.5, // Placeholder
        modeDistribution: { osu: 33, mania: 33, taiko: 34 }, // Placeholder
        bestRank: loadBestRank(chart.id),
        source: 'user',
        uploadedAt: chart.metadata.uploadedAt
      })
    }
  } catch (e) {
    console.error('Failed to load user charts:', e)
  }
}

function selectMap(name: string) {
  const metadata = chartsMetadata.value.get(name)
  if (metadata?.source === 'user') {
    // User chart - load from IndexedDB
    router.push({ path: '/play', query: { chart: name, source: 'user' } })
  } else {
    // Public chart - load from /charts/
    router.push({ path: '/play', query: { chart: name } })
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function handleUploadClick() {
  uploadInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  await uploadChart(file)
  input.value = '' // Reset input
}

async function uploadChart(file: File) {
  if (!file.name.endsWith('.zip')) {
    error.value = '请上传 .zip 格式的谱面包'
    return
  }

  uploading.value = true
  uploadProgress.value = '正在上传...'
  error.value = ''

  try {
    // Extract chart name from filename
    const chartName = file.name.replace(/\.zip$/i, '')

    // Save to IndexedDB
    uploadProgress.value = '正在保存到本地存储...'
    const chartId = await chartStorage.saveChart(chartName, file)

    uploadProgress.value = '正在加载元数据...'
    await loadUserCharts()

    uploadProgress.value = '上传成功！'
    setTimeout(() => {
      uploadProgress.value = ''
    }, 2000)
  } catch (e: any) {
    error.value = `上传失败: ${e.message}`
  } finally {
    uploading.value = false
  }
}

async function deleteChart(chartId: string, event: Event) {
  event.stopPropagation()

  if (!confirm('确定要删除这个谱面吗？')) return

  try {
    await chartStorage.deleteChart(chartId)
    await loadUserCharts()
  } catch (e: any) {
    error.value = `删除失败: ${e.message}`
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  // Check if it's a ZIP file (user chart)
  const zipFile = Array.from(files).find((f) => f.name.endsWith('.zip'))
  if (zipFile) {
    uploadChart(zipFile)
    return
  }

  // Otherwise, handle .osu file import
  const osuFile = Array.from(files).find((f) => f.name.endsWith('.osu'))
  const audioFile = Array.from(files).find((f) =>
    /\.(mp3|ogg|wav)$/i.test(f.name),
  )

  if (!osuFile) {
    error.value = '请拖入 .zip 谱面包 或 .osu 文件（可同时拖入音频文件）'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const text = reader.result as string
      const audioName = audioFile?.name ?? 'audio.mp3'
      const chart = convertOsuToChart(text, audioName)

      // Store in sessionStorage for Play page to pick up
      sessionStorage.setItem('osu-chart', JSON.stringify(chart))
      if (audioFile) {
        // Store audio as data URL
        const audioReader = new FileReader()
        audioReader.onload = () => {
          sessionStorage.setItem('osu-audio', audioReader.result as string)
          router.push({ path: '/play', query: { chart: '__osu_import__' } })
        }
        audioReader.readAsDataURL(audioFile)
      } else {
        router.push({ path: '/play', query: { chart: '__osu_import__' } })
      }
    } catch (err: any) {
      error.value = `转换失败: ${err.message}`
    }
  }
  reader.readAsText(osuFile)
}
</script>

<template>
  <div
    class="song-select"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- 星空背景层 -->
    <div class="starfield"></div>
    
    <!-- 顶部导航栏 -->
    <nav class="top-nav">
      <div class="logo-section">
        <h1 class="logo">AstroDJ</h1>
        <span class="subtitle">星链电台 · 信号修复系统</span>
      </div>
      <div class="nav-actions">
        <button @click="handleUploadClick" class="upload-btn" :disabled="uploading">
          <IconFolder class="icon" />
          <span>{{ uploading ? uploadProgress : '上传谱面' }}</span>
        </button>
        <router-link to="/editor" class="editor-btn">
          <IconEdit class="icon" />
          <span>制谱器</span>
        </router-link>
      </div>
      <input
        ref="uploadInput"
        type="file"
        accept=".zip"
        style="display: none"
        @change="handleFileSelect"
      />
    </nav>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 左侧：谱面列表 -->
      <section class="beatmap-list">
        <div class="list-header">
          <h2>任务列表</h2>
          <span class="count">{{ allCharts.length }} 个星域</span>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>正在扫描星域...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <IconAlert class="error-icon" />
          <p>{{ error }}</p>
        </div>

        <div v-else class="beatmap-cards">
          <div
            v-for="({ id, metadata }, index) in allCharts"
            :key="id"
            class="beatmap-card"
            :class="{ 'user-chart': metadata.source === 'user' }"
            :style="{ animationDelay: `${index * 0.05}s` }"
            @click="selectMap(id)"
          >
            <div class="card-bg"></div>
            <div class="card-content">
              <div class="card-info">
                <div class="card-header">
                  <h3 class="song-title">
                    {{ metadata.name }}
                    <span v-if="metadata.source === 'user'" class="user-badge">本地</span>
                  </h3>
                  <div class="card-actions">
                    <div v-if="metadata.bestRank" class="best-rank-badge" :class="`rank-${metadata.bestRank}`">
                      {{ metadata.bestRank }}
                    </div>
                    <button
                      v-if="metadata.source === 'user'"
                      @click="deleteChart(id, $event)"
                      class="delete-btn"
                      title="删除谱面"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p class="song-meta">混合模式 · 多频段协同</p>
                
                <!-- Metadata row -->
                <div class="metadata-row">
                  <span class="metadata-item">
                    <span class="metadata-icon">⏱</span>
                    {{ formatDuration(metadata.duration) }}
                  </span>
                  <span class="metadata-item">
                    <span class="metadata-icon">♪</span>
                    {{ metadata.bpm ?? 'N/A' }} BPM
                  </span>
                  <span class="metadata-item">
                    <span class="metadata-icon">★</span>
                    {{ metadata.stars.toFixed(1) }}
                  </span>
                </div>
                
                <!-- Mode distribution bar -->
                <div class="mode-distribution">
                  <div class="distribution-bar">
                    <div 
                      class="distribution-segment osu-segment" 
                      :style="{ width: `${metadata.modeDistribution.osu}%` }"
                    ></div>
                    <div 
                      class="distribution-segment mania-segment" 
                      :style="{ width: `${metadata.modeDistribution.mania}%` }"
                    ></div>
                    <div 
                      class="distribution-segment taiko-segment" 
                      :style="{ width: `${metadata.modeDistribution.taiko}%` }"
                    ></div>
                  </div>
                  <div class="distribution-labels">
                    <span class="label-osu">OSU {{ metadata.modeDistribution.osu }}%</span>
                    <span class="label-mania">MANIA {{ metadata.modeDistribution.mania }}%</span>
                    <span class="label-taiko">TAIKO {{ metadata.modeDistribution.taiko }}%</span>
                  </div>
                </div>
              </div>
              <div class="card-action">
                <div class="play-icon">
                  <IconPlay class="play-svg" />
                </div>
              </div>
            </div>
            <div class="card-glow"></div>
          </div>

          <div v-if="allCharts.length === 0" class="empty-state">
            <IconMusic class="empty-icon" />
            <p>暂无可用任务</p>
            <small>点击"上传谱面"按钮或拖拽谱面包到此处</small>
          </div>
        </div>
      </section>

      <!-- 右侧：轮播图和拖放区域 -->
      <aside class="import-panel">
        <!-- 轮播图区域 -->
        <div class="carousel-section">
          <div class="carousel-container">
            <div class="carousel-slide">
              <img src="/hero.png" alt="AstroDJ Hero" class="carousel-image" />
              <div class="carousel-overlay">
                <h3 class="carousel-title">星链电台</h3>
                <p class="carousel-subtitle">探索音乐的无限可能</p>
              </div>
            </div>
          </div>
        </div>

        <div class="drop-zone" :class="{ active: dragOver }">
          <div class="drop-content">
            <IconFolder class="drop-icon" />
            <h3>快速导入</h3>
            <p class="drop-desc">拖拽 .zip 谱面包到此处</p>
            <p class="drop-hint">或拖拽 .osu 文件 + 音频进行转换</p>
            <button @click="handleUploadClick" class="drop-upload-btn" :disabled="uploading">
              选择文件上传
            </button>
          </div>
          <div class="drop-border"></div>
        </div>

        <div class="info-cards">
          <div class="info-card">
            <div class="info-icon">
              <IconGamepad />
            </div>
            <div class="info-text">
              <h4>混合玩法</h4>
              <p>同时操作三种模式</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-icon">
              <IconZap />
            </div>
            <div class="info-text">
              <h4>本地存储</h4>
              <p>谱面保存在浏览器</p>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.song-select {
  min-height: 100vh;
  background: var(--astro-bg-gradient);
  position: relative;
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
    radial-gradient(2px 2px at 15% 25%, rgba(255,255,255,0.8), transparent),
    radial-gradient(2px 2px at 85% 75%, rgba(0,217,255,0.6), transparent),
    radial-gradient(1px 1px at 45% 55%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 65% 35%, rgba(107,76,230,0.5), transparent),
    radial-gradient(2px 2px at 25% 80%, rgba(255,255,255,0.7), transparent);
  background-size: 250% 250%;
  animation: starfield 200s linear infinite;
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
}

/* 顶部导航 */
.top-nav {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 40px;
  background: var(--astro-glass-bg);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(107, 76, 230, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.logo-section {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.logo {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

.subtitle {
  color: var(--astro-plasma-cyan);
  font-size: 0.9rem;
  opacity: 0.8;
}

.nav-actions {
  display: flex;
  gap: 12px;
}

.upload-btn,
.editor-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  color: white;
  text-decoration: none;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--astro-glow-purple);
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-btn:not(:disabled):hover,
.editor-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(107, 76, 230, 0.8);
}

.upload-btn .icon,
.editor-btn .icon {
  width: 20px;
  height: 20px;
}

/* 主内容区 */
.main-content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
  padding: 32px 40px;
  max-width: 1600px;
  margin: 0 auto;
}

/* 谱面列表 */
.beatmap-list {
  background: var(--astro-panel-bg);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(107, 76, 230, 0.3);
  padding: 24px;
  box-shadow: var(--astro-glow-purple);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(107, 76, 230, 0.2);
}

.list-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--astro-star-white);
  font-weight: 600;
}

.count {
  color: var(--astro-plasma-cyan);
  font-size: 0.9rem;
  padding: 4px 12px;
  background: rgba(0, 217, 255, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(0, 217, 255, 0.3);
}

/* 加载/错误状态 */
.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--astro-star-white);
  opacity: 0.7;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(107, 76, 230, 0.2);
  border-top-color: var(--astro-nebula-purple);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon, .empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  color: var(--astro-plasma-cyan);
  opacity: 0.6;
}

/* 谱面卡片 */
.beatmap-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  padding-right: 8px;
}

.beatmap-cards::-webkit-scrollbar {
  width: 6px;
}

.beatmap-cards::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.beatmap-cards::-webkit-scrollbar-thumb {
  background: var(--astro-nebula-purple);
  border-radius: 3px;
}

.beatmap-card {
  position: relative;
  padding: 20px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  animation: slideIn 0.4s ease-out backwards;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.card-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(107, 76, 230, 0.15), rgba(0, 217, 255, 0.1));
  border: 1px solid rgba(107, 76, 230, 0.3);
  border-radius: inherit;
  transition: all 0.3s ease;
}

.card-glow {
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  border-radius: inherit;
  opacity: 0;
  filter: blur(10px);
  transition: opacity 0.3s ease;
  z-index: -1;
}

.beatmap-card:hover .card-bg {
  background: linear-gradient(135deg, rgba(107, 76, 230, 0.25), rgba(0, 217, 255, 0.2));
  border-color: var(--astro-plasma-cyan);
}

.beatmap-card:hover .card-glow {
  opacity: 0.6;
}

.beatmap-card:hover {
  transform: translateX(8px);
}

.card-content {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-info {
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.song-title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--astro-star-white);
  font-weight: 600;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 700;
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.3), rgba(107, 76, 230, 0.3));
  border: 1px solid var(--astro-plasma-cyan);
  border-radius: 4px;
  color: var(--astro-plasma-cyan);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.best-rank-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 0 10px currentColor;
}

.delete-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 68, 102, 0.2);
  border: 1px solid rgba(255, 68, 102, 0.5);
  border-radius: 4px;
  color: #ff4466;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  line-height: 1;
}

.delete-btn:hover {
  background: rgba(255, 68, 102, 0.4);
  border-color: #ff4466;
  transform: scale(1.1);
}

.user-chart .card-bg {
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.15), rgba(107, 76, 230, 0.15));
  border-color: rgba(0, 217, 255, 0.4);
}

.rank-SS { background: linear-gradient(135deg, #ffd700, #ffed4e); color: #000; }
.rank-S { background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; }
.rank-A { background: linear-gradient(135deg, #00ff88, #00d9ff); color: #000; }
.rank-B { background: linear-gradient(135deg, #4a9eff, #00d9ff); color: #fff; }
.rank-C { background: linear-gradient(135deg, #ff8c42, #ffaa00); color: #000; }
.rank-D { background: linear-gradient(135deg, #ff4466, #ff8c42); color: #fff; }

.song-meta {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  color: var(--astro-plasma-cyan);
  opacity: 0.8;
}

.metadata-row {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 0.85rem;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.7);
}

.metadata-icon {
  color: var(--astro-plasma-cyan);
  font-size: 0.9rem;
}

.mode-distribution {
  margin-top: 10px;
}

.distribution-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  margin-bottom: 6px;
}

.distribution-segment {
  transition: width 0.3s ease;
}

.osu-segment {
  background: var(--freq-high);
  box-shadow: 0 0 8px var(--freq-high);
}

.mania-segment {
  background: var(--freq-mid);
  box-shadow: 0 0 8px var(--freq-mid);
}

.taiko-segment {
  background: var(--freq-low);
  box-shadow: 0 0 8px var(--freq-low);
}

.distribution-labels {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.label-osu { color: var(--freq-high); }
.label-mania { color: var(--freq-mid); }
.label-taiko { color: var(--freq-low); }

.card-action {
  display: flex;
  align-items: center;
}

.play-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  border-radius: 50%;
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 0 15px rgba(107, 76, 230, 0.5);
}

.play-svg {
  width: 20px;
  height: 20px;
  margin-left: 2px;
}

.beatmap-card:hover .play-icon {
  transform: scale(1.1);
  box-shadow: 0 0 25px rgba(107, 76, 230, 0.8);
}

/* 导入面板 */
.import-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 轮播图区域 */
.carousel-section {
  background: transparent;
  border-radius: 16px;
  border: 1px solid rgba(107, 76, 230, 0.3);
  overflow: hidden;
  box-shadow: var(--astro-glow-purple);
}

.carousel-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.carousel-slide {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.carousel-slide:hover .carousel-image {
  transform: scale(1.05);
}

.carousel-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px;
  background: linear-gradient(to top, rgba(10, 10, 26, 0.95), transparent);
  backdrop-filter: blur(5px);
}

.carousel-title {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--astro-star-white);
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.carousel-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--astro-plasma-cyan);
  opacity: 0.9;
}

.drop-zone {
  position: relative;
  background: var(--astro-panel-bg);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 2px dashed rgba(107, 76, 230, 0.4);
  padding: 40px 24px;
  transition: all 0.3s ease;
  overflow: hidden;
}

.drop-zone.active {
  border-color: var(--astro-plasma-cyan);
  background: rgba(0, 217, 255, 0.1);
  box-shadow: var(--astro-glow-cyan);
}

.drop-border {
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  border-radius: inherit;
  opacity: 0;
  filter: blur(8px);
  transition: opacity 0.3s ease;
  z-index: -1;
}

.drop-zone.active .drop-border {
  opacity: 0.5;
}

.drop-content {
  text-align: center;
}

.drop-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: var(--astro-plasma-cyan);
  opacity: 0.8;
}

.drop-content h3 {
  margin: 0 0 12px 0;
  font-size: 1.3rem;
  color: var(--astro-star-white);
  font-weight: 600;
}

.drop-desc {
  margin: 0 0 8px 0;
  color: var(--astro-plasma-cyan);
  font-size: 1rem;
}

.drop-hint {
  margin: 0 0 16px 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
}

.drop-upload-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.drop-upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drop-upload-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 0 15px rgba(107, 76, 230, 0.6);
}

/* 信息卡片 */
.info-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--astro-glass-bg);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(107, 76, 230, 0.2);
}

.info-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(107, 76, 230, 0.2), rgba(0, 217, 255, 0.2));
  border-radius: 10px;
  color: var(--astro-plasma-cyan);
}

.info-icon svg {
  width: 24px;
  height: 24px;
}

.info-text h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: var(--astro-star-white);
  font-weight: 600;
}

.info-text p {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

/* 响应式 - 平板 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .import-panel {
    flex-direction: column;
  }

  .carousel-section {
    width: 100%;
  }

  .drop-zone {
    flex: 1;
  }

  .info-cards {
    flex-direction: row;
    flex: 1;
  }
}

/* 响应式 - 小平板 */
@media (max-width: 1024px) {
  .top-nav {
    padding: 20px 32px;
  }

  .logo {
    font-size: 1.8rem;
  }

  .subtitle {
    font-size: 0.85rem;
  }

  .main-content {
    padding: 24px 32px;
  }

  .beatmap-list {
    padding: 20px;
  }

  .list-header h2 {
    font-size: 1.3rem;
  }
}

/* 响应式 - 手机横屏 */
@media (max-width: 768px) and (orientation: landscape) {
  .top-nav {
    padding: 12px 20px;
  }

  .logo {
    font-size: 1.4rem;
  }

  .subtitle {
    font-size: 0.75rem;
  }

  .editor-btn {
    padding: 8px 16px;
    font-size: 0.85rem;
  }

  .editor-btn .icon {
    width: 16px;
    height: 16px;
  }

  .main-content {
    padding: 16px 20px;
    gap: 16px;
  }

  .beatmap-list {
    padding: 16px;
  }

  .list-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
  }

  .list-header h2 {
    font-size: 1.1rem;
  }

  .count {
    font-size: 0.8rem;
    padding: 3px 10px;
  }

  .beatmap-cards {
    max-height: calc(100vh - 220px);
    gap: 8px;
  }

  .beatmap-card {
    padding: 14px;
  }

  .song-title {
    font-size: 1rem;
  }

  .song-meta {
    font-size: 0.75rem;
  }

  .play-icon {
    width: 40px;
    height: 40px;
  }

  .play-svg {
    width: 16px;
    height: 16px;
  }

  .import-panel {
    flex-direction: column;
  }

  .drop-zone {
    padding: 24px 16px;
  }

  .drop-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
  }

  .drop-content h3 {
    font-size: 1.1rem;
    margin-bottom: 8px;
  }

  .drop-desc {
    font-size: 0.9rem;
  }

  .drop-hint {
    font-size: 0.75rem;
  }

  .info-cards {
    flex-direction: column;
    gap: 8px;
  }

  .info-card {
    padding: 12px;
    gap: 12px;
  }

  .info-icon {
    width: 40px;
    height: 40px;
  }

  .info-icon svg {
    width: 20px;
    height: 20px;
  }

  .info-text h4 {
    font-size: 0.9rem;
  }

  .info-text p {
    font-size: 0.75rem;
  }
}

/* 响应式 - 手机竖屏 */
@media (max-width: 768px) and (orientation: portrait) {
  .song-select {
    filter: blur(3px);
  }

  .song-select::after {
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

  .top-nav,
  .main-content {
    opacity: 0.3;
    pointer-events: none;
  }
}

/* 超大屏幕优化 */
@media (min-width: 1920px) {
  .main-content {
    max-width: 1800px;
    padding: 40px 60px;
  }

  .beatmap-list {
    padding: 32px;
  }

  .list-header h2 {
    font-size: 1.8rem;
  }

  .beatmap-card {
    padding: 24px;
  }

  .song-title {
    font-size: 1.4rem;
  }

  .play-icon {
    width: 56px;
    height: 56px;
  }

  .play-svg {
    width: 24px;
    height: 24px;
  }
}
</style>
