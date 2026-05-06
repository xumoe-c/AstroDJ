<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { initWasm, validateChart, judge } from '../game/wasm'
import { AudioEngine } from '../game/audio'
import { GlobalScorer, calculateTotalNotes } from '../game/scorer'
import { TimelineController } from '../game/timeline'
import { ManiaRuntime } from '../game/runtimes/mania'
import { TaikoRuntime } from '../game/runtimes/taiko'
import { OsuStandardRuntime } from '../game/runtimes/osu-standard'
import { Judgement, type Chart } from '../game/types'
import type { RuntimeContext } from '../game/runtimes/interface'
import type { TransitionInfo } from '../game/runtime-manager'
import { ChartParserImpl } from '../game/parser'
import { ChartValidatorImpl } from '../game/validator'
import { formatChartError, formatValidationReport, hasCriticalErrors } from '../game/error-handler'
import { AutoPlayController } from '../game/auto-play'
import { chartStorage } from '../services/chart-storage'

const route = useRoute()
const router = useRouter()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const backgroundImageUrl = ref<string | null>(null)
const status = ref('加载中...')
const errorDetails = ref<string | null>(null)
const showErrorDetails = ref(false)
const started = ref(false)
const combo = ref(0)
const accuracy = ref(100)
const score = ref(0)
const activeMode = ref('')
const modeAccuracy = ref({
  'osu-standard': 100,
  'mania': 100,
  'taiko': 100
})
const debug = ref(false)
const debugInfo = ref({ songMs: 0, segId: '', mode: '', fps: 0 })
const scrollSpeedDisplay = ref<string | null>(null)
let scrollSpeedTimeout: number | null = null
const transitionInfo = ref<TransitionInfo | null>(null)
const showTransitionFlash = ref(false)
const transitionFlashColor = ref('#4a9eff')
const autoPlayEnabled = ref(false)
const showAutoPlayIndicator = ref(false)

// ACC Indicator state
const accOffset = ref(0)
const accVisible = ref(false)
let accHideTimeout: number | null = null

const JUDGE_LABELS: Record<number, string> = {
  [Judgement.CriticalPerfect]: 'CRITICAL', [Judgement.Perfect]: 'PERFECT',
  [Judgement.Great]: 'GREAT', [Judgement.Good]: 'GOOD',
  [Judgement.Miss]: 'MISS',
}
const JUDGE_COLORS: Record<number, string> = {
  [Judgement.CriticalPerfect]: '#00ffff', [Judgement.Perfect]: '#ffdd00',
  [Judgement.Great]: '#88ff44', [Judgement.Good]: '#44ddff',
  [Judgement.Miss]: '#ff4444',
}
const lastJudge = ref<Judgement | null>(null)

let audio: AudioEngine | null = null
let timeline: TimelineController | null = null
let scorer: GlobalScorer | null = null
let animId = 0
let chart: Chart | null = null
let lastSegmentId: string | null = null
let lastFrameTime = 0
let frameCount = 0
let fps = 0
let autoPlay: AutoPlayController | null = null
const parser = new ChartParserImpl()
const validator = new ChartValidatorImpl()

const MODE_COLORS: Record<string, string> = {
  'mania': '#4a9eff',
  'taiko': '#ff4a4a',
  'osu-standard': '#ff69b4'
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.repeat) return
  
  // Prevent browser shortcuts for game keys
  const gameKeys = ['F3', 'F4', 'F5', 'F11', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']
  if (gameKeys.includes(e.key)) {
    e.preventDefault()
  }
  
  if (e.key === '`') { debug.value = !debug.value; return }
  
  // Toggle auto-play with Tab key
  if (e.key === 'Tab') {
    autoPlayEnabled.value = !autoPlayEnabled.value
    autoPlay?.setEnabled(autoPlayEnabled.value)
    
    // Show indicator
    showAutoPlayIndicator.value = true
    setTimeout(() => {
      showAutoPlayIndicator.value = false
    }, 2000)
    
    return
  }
  
  // Handle scroll speed display for F3/F4
  if (e.key === 'F3' || e.key === 'F4') {
    // Show scroll speed indicator
    if (scrollSpeedTimeout) clearTimeout(scrollSpeedTimeout)
    
    // Get current scroll speed from timeline (will be updated by runtime)
    setTimeout(() => {
      const runtime = (timeline as any)?.activeRuntime
      if (runtime && 'scrollSpeedMultiplier' in runtime) {
        const multiplier = runtime.scrollSpeedMultiplier
        scrollSpeedDisplay.value = `${(multiplier * 100).toFixed(0)}%`
        
        // Hide after 2 seconds
        scrollSpeedTimeout = window.setTimeout(() => {
          scrollSpeedDisplay.value = null
        }, 2000)
      }
    }, 50)
  }
  
  // Don't pass key events to timeline if auto-play is enabled
  if (!autoPlayEnabled.value) {
    timeline?.handleKeyDown(e.key, audio?.songTimeMs ?? 0)
  }
}
const onKeyUp = (e: KeyboardEvent) => {
  // Prevent browser shortcuts for game keys
  const gameKeys = ['F3', 'F4', 'F5', 'F11', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']
  if (gameKeys.includes(e.key)) {
    e.preventDefault()
  }
  
  // Don't pass key events to timeline if auto-play is enabled
  if (!autoPlayEnabled.value) {
    timeline?.handleKeyUp(e.key, audio?.songTimeMs ?? 0)
  }
}
const onTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = canvasRef.value.width / rect.width
  for (let i = 0; i < e.changedTouches.length; i++) {
    const x = (e.changedTouches[i].clientX - rect.left) * scaleX
    timeline?.handleTouchStart(x, audio?.songTimeMs ?? 0)
  }
}
const onTouchEnd = (e: TouchEvent) => {
  e.preventDefault()
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = canvasRef.value.width / rect.width
  for (let i = 0; i < e.changedTouches.length; i++) {
    const x = (e.changedTouches[i].clientX - rect.left) * scaleX
    timeline?.handleTouchEnd(x, audio?.songTimeMs ?? 0)
  }
}

onMounted(async () => {
  const chartName = route.query.chart as string
  const chartSource = route.query.source as string
  
  if (!chartName) {
    status.value = '未指定谱面'
    errorDetails.value = '请从歌曲选择界面选择一个谱面'
    return
  }

  try {
    status.value = '加载 WASM...'
    await initWasm()

    if (chartSource === 'user') {
      // Load from IndexedDB (user-uploaded chart)
      status.value = '加载本地谱面...'
      const chartData = await chartStorage.loadChartData(chartName)
      
      if (!chartData) {
        throw new Error('未找到谱面数据')
      }
      
      chart = chartData.chart
      
      // Validate chart
      const validationErrors = validator.validate(chart)
      if (validationErrors.length > 0) {
        const report = formatValidationReport(validationErrors)
        console.warn('Chart validation warnings:', report)
        
        if (hasCriticalErrors(validationErrors)) {
          status.value = '谱面验证失败'
          errorDetails.value = report
          return
        }
      }
      
      console.log(`Loaded user chart: ${chart.meta.title} by ${chart.meta.artist}, ${chart.segments.length} segments`)
      
      // Load background/cover
      if (chartData.coverUrl) {
        backgroundImageUrl.value = chartData.coverUrl
      } else if (chart.meta.coverArt) {
        backgroundImageUrl.value = chart.meta.coverArt
      }
      
      // Load audio
      status.value = '加载音频...'
      audio = new AudioEngine()
      await audio.load(chartData.audioUrl)
      
    } else if (chartName === '__osu_import__') {
      // Load from sessionStorage (osu! import)
      status.value = '加载导入谱面...'
      const chartJson = sessionStorage.getItem('osu-chart')
      
      console.log('=== Loading chart from sessionStorage ===')
      console.log('Chart JSON exists:', !!chartJson)
      console.log('Chart JSON length:', chartJson?.length)
      console.log('Chart JSON first 200 chars:', chartJson?.substring(0, 200))
      console.log('Chart JSON type:', typeof chartJson)
      
      if (!chartJson) {
        throw new Error('未找到导入的谱面数据')
      }
      
      // Check if it's HTML instead of JSON
      const trimmed = chartJson.trim()
      if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
        console.error('❌ sessionStorage contains HTML instead of JSON!')
        console.error('Full content (first 1000 chars):', chartJson.substring(0, 1000))
        
        // Clear the corrupted data
        sessionStorage.removeItem('osu-chart')
        sessionStorage.removeItem('osu-audio')
        
        throw new Error('谱面数据格式错误：存储的是 HTML 而不是 JSON。已清除损坏的数据，请重新导入。')
      }
      
      // Check if it starts with valid JSON
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        console.error('❌ sessionStorage does not contain valid JSON!')
        console.error('Content starts with:', trimmed.substring(0, 50))
        
        // Clear the corrupted data
        sessionStorage.removeItem('osu-chart')
        sessionStorage.removeItem('osu-audio')
        
        throw new Error('谱面数据格式错误：不是有效的 JSON 格式。已清除损坏的数据，请重新导入。')
      }
      
      console.log('✓ Chart JSON appears to be valid, attempting to parse...')
      
      // Parse and validate chart
      const parseResult = parser.parseJSON(chartJson)
      if (!parseResult.ok) {
        const errorMsg = formatChartError(parseResult.error)
        status.value = '谱面解析失败'
        errorDetails.value = errorMsg
        console.error('❌ Chart parse error:', parseResult.error)
        console.error('Chart JSON that failed to parse (first 500 chars):', chartJson.substring(0, 500))
        
        // Clear the corrupted data
        sessionStorage.removeItem('osu-chart')
        sessionStorage.removeItem('osu-audio')
        
        return
      }
      
      console.log('✓ Chart parsed successfully')
      
      chart = parseResult.value
      
      // Validate chart
      const validationErrors = validator.validate(chart)
      if (validationErrors.length > 0) {
        const report = formatValidationReport(validationErrors)
        console.warn('Chart validation warnings:', report)
        
        // Only block if there are critical errors
        if (hasCriticalErrors(validationErrors)) {
          status.value = '谱面验证失败'
          errorDetails.value = report
          return
        } else {
          // Show warnings but allow play
          console.warn('Chart has warnings but will allow play:', report)
        }
      }
      
      console.log(`Imported: ${chart.meta.title} by ${chart.meta.artist}, ${chart.segments.length} segments`)

      // Try to load background image from osuMetadata
      if (chart.osuMetadata?.beatmapSetID) {
        const bgData = sessionStorage.getItem('osu-background')
        if (bgData) {
          backgroundImageUrl.value = bgData
        }
      }

      status.value = '加载音频...'
      audio = new AudioEngine()
      const audioData = sessionStorage.getItem('osu-audio')
      if (audioData) {
        await audio.load(audioData) // data URL
      } else {
        throw new Error('未找到音频文件，请同时拖入 .osu 和音频文件')
      }
    } else {
      // Normal chart loading
      status.value = '加载谱面...'
      const chartRes = await fetch(`/charts/${chartName}/chart.json`)
      if (!chartRes.ok) {
        throw new Error(`无法加载 chart.json: HTTP ${chartRes.status}`)
      }
      const chartText = await chartRes.text()

      // Parse chart
      const parseResult = parser.parseJSON(chartText)
      if (!parseResult.ok) {
        const errorMsg = formatChartError(parseResult.error)
        status.value = '谱面解析失败'
        errorDetails.value = errorMsg
        console.error('Chart parse error:', parseResult.error)
        return
      }
      
      chart = parseResult.value
      
      // Validate chart
      const validationErrors = validator.validate(chart)
      if (validationErrors.length > 0) {
        const report = formatValidationReport(validationErrors)
        console.warn('Chart validation warnings:', report)
        
        // Only block if there are critical errors
        if (hasCriticalErrors(validationErrors)) {
          status.value = '谱面验证失败'
          errorDetails.value = report
          return
        } else {
          // Show warnings but allow play
          console.warn('Chart has warnings but will allow play')
        }
      }
      
      console.log(`Loaded: ${chart.meta.title} by ${chart.meta.artist}, ${chart.segments.length} segments`)

      // Load cover art and background image
      // Priority: 1. chart.meta (data URL), 2. separate files
      if (chart.meta.coverArt) {
        // Use cover art from chart.meta (data URL)
        backgroundImageUrl.value = chart.meta.coverArt
      } else if (chart.meta.background) {
        // Use background from chart.meta (data URL)
        backgroundImageUrl.value = chart.meta.background
      } else {
        // Try to load from separate files
        try {
          // Try cover.jpg first
          let bgRes = await fetch(`/charts/${chartName}/cover.jpg`)
          if (!bgRes.ok) {
            // Try bg.jpg as fallback
            bgRes = await fetch(`/charts/${chartName}/bg.jpg`)
          }
          if (bgRes.ok) {
            const blob = await bgRes.blob()
            backgroundImageUrl.value = URL.createObjectURL(blob)
          }
        } catch (e) {
          // Background image is optional, ignore errors
          console.log('No background image found')
        }
      }

      status.value = '加载音频...'
      audio = new AudioEngine()
      await audio.load(`/charts/${chartName}/${chart.meta.audio}`)
    }

    status.value = '准备就绪'
  } catch (e: any) {
    status.value = `错误: ${e.message}`
    errorDetails.value = e.stack || e.message
    console.error('Chart loading error:', e)
  }
})

onUnmounted(() => {
  cleanup()
})

function cleanup() {
  if (animId) { cancelAnimationFrame(animId); animId = 0 }
  timeline?.destroy()
  audio?.stop()
  autoPlay?.destroy()
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  canvasRef.value?.removeEventListener('touchstart', onTouchStart)
  canvasRef.value?.removeEventListener('touchend', onTouchEnd)
  canvasRef.value?.removeEventListener('touchcancel', onTouchEnd)
  
  // Clean up background image URL if it was created from blob
  if (backgroundImageUrl.value && backgroundImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(backgroundImageUrl.value)
  }
}

function startGame() {
  if (!chart || !audio || !canvasRef.value) return

  scorer = new GlobalScorer()
  const totalNotes = calculateTotalNotes(chart)
  scorer.reset(totalNotes)

  const canvas = canvasRef.value
  const ctx2d = canvas.getContext('2d', {
    alpha: false,           // Disable alpha for better performance
    desynchronized: true    // Allow desynchronized rendering for lower latency
  })!
  const runtimeCtx: RuntimeContext = {
    canvas,
    ctx2d,
    area: { x: 0, y: 0, w: canvas.width, h: canvas.height },
    scorer,
    judge: (rule: string, delta: number) => judge(rule, delta) as Judgement,
    onJudgement: (j: Judgement, x: number, y: number, offset?: number) => {
      lastJudge.value = j
      combo.value = scorer!.combo
      accuracy.value = Math.round(scorer!.accuracy * 10000) / 100
      modeAccuracy.value['osu-standard'] = Math.round(scorer!.getModeAccuracy('osu-standard') * 1000) / 10
      modeAccuracy.value['mania'] = Math.round(scorer!.getModeAccuracy('mania') * 1000) / 10
      modeAccuracy.value['taiko'] = Math.round(scorer!.getModeAccuracy('taiko') * 1000) / 10
      score.value = scorer!.score
      
      // Update ACC indicator
      if (offset !== undefined) {
        accOffset.value = offset
        accVisible.value = true
        
        // Clear previous timeout
        if (accHideTimeout !== null) {
          clearTimeout(accHideTimeout)
        }
        
        // Hide after 2 seconds of no judgments
        accHideTimeout = window.setTimeout(() => {
          accVisible.value = false
        }, 2000)
      }
    },
  }

  // Requirement 21.5: Use TimelineController (RuntimeManager equivalent) to load all segments
  timeline = new TimelineController(chart, runtimeCtx, {
    mania: () => new ManiaRuntime(),
    taiko: () => new TaikoRuntime(),
    'osu-standard': () => new OsuStandardRuntime(),
  })

  // Initialize auto-play controller
  autoPlay = new AutoPlayController(chart, timeline, {
    enabled: false,
    perfectTiming: true,
    randomnessMs: 5
  })

  // Requirement 21.9: Support starting from specified time point
  const startTimeParam = route.query.startTime
  const startTimeMs = startTimeParam ? parseInt(startTimeParam as string, 10) : 0
  const delayMs = startTimeMs > 0 ? 500 : 1500 // Shorter delay if starting mid-song

  audio.resume()
  audio.start(delayMs, startTimeMs)

  audio.onEnded(() => {
    endGame()
  })

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd, { passive: false })
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false })

  started.value = true
  lastFrameTime = performance.now()
  gameLoop()
}

function gameLoop() {
  if (!timeline || !audio) return

  // Calculate FPS for high refresh rate monitoring
  const now = performance.now()
  frameCount++
  if (now - lastFrameTime >= 1000) {
    fps = Math.round(frameCount * 1000 / (now - lastFrameTime))
    frameCount = 0
    lastFrameTime = now
  }

  const songMs = audio.songTimeMs
  
  // Update auto-play controller
  autoPlay?.tick(songMs)
  
  timeline.tick(songMs)

  // Update HUD
  if (scorer) {
    combo.value = scorer.combo
    accuracy.value = Math.round(scorer.accuracy * 10000) / 100
    modeAccuracy.value['osu-standard'] = Math.round(scorer.getModeAccuracy('osu-standard') * 1000) / 10
    modeAccuracy.value['mania'] = Math.round(scorer.getModeAccuracy('mania') * 1000) / 10
    modeAccuracy.value['taiko'] = Math.round(scorer.getModeAccuracy('taiko') * 1000) / 10
    score.value = scorer.score
  }
  
  // Detect segment transition and trigger flash effect
  const currentSegmentId = timeline.activeSegmentId
  if (currentSegmentId !== lastSegmentId && lastSegmentId !== null) {
    triggerTransitionFlash(timeline.activeMode ?? 'mania')
  }
  lastSegmentId = currentSegmentId
  
  activeMode.value = timeline.activeMode ?? ''

  // Update transition info for TransitionIndicator
  transitionInfo.value = timeline.getTransitionInfo(songMs)

  if (debug.value) {
    debugInfo.value = {
      songMs: Math.round(songMs),
      segId: timeline.activeSegmentId ?? 'none',
      mode: timeline.activeMode ?? 'none',
      fps: fps
    }
  }

  if (timeline.isAllComplete(songMs)) {
    endGame()
    return
  }

  animId = requestAnimationFrame(gameLoop)
}

function triggerTransitionFlash(mode: string) {
  transitionFlashColor.value = MODE_COLORS[mode] || '#4a9eff'
  showTransitionFlash.value = true
  
  // Hide flash after 200ms
  setTimeout(() => {
    showTransitionFlash.value = false
  }, 200)
}

function getResonanceStatus(acc: number) {
      if (acc >= 95) return 'PERFECT';
        if (acc >= 85) return 'STABLE';
          if (acc >= 75) return 'WARNING';
            return 'CRITICAL';
            }
            
function getResonanceClass(acc: number) {
    if (acc >= 95) return 'status-perfect';
    if (acc >= 85) return 'status-stable';
     if (acc >= 75) return 'status-warning';
       return 'status-critical';
    }

function getAccColor(acc: number) {
    if (acc >= 95) return '#00ff88';
    if (acc >= 85) return '#00d9ff';
    if (acc >= 75) return '#ffdd00';
    return '#ff4444';
}

function getOffsetColor(offset: number): string {
    const absOffset = Math.abs(offset)
    if (absOffset <= 16) return '#00ff88'      // Perfect - 绿色
    if (absOffset <= 40) return '#00d9ff'      // Great - 青色
    if (absOffset <= 80) return '#ffdd00'      // Good - 黄色
    return '#ff4444'                            // Miss - 红色
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function endGame() {
  cleanup()
  if (!scorer) return

  const counts: Record<string, number> = {}
  for (const k in scorer.counts) counts[k] = scorer.counts[k]

  router.push({
    path: '/result',
    query: {
      score: String(scorer.score),
      maxCombo: String(scorer.maxCombo),
      accuracy: String(Math.round(scorer.accuracy * 10000) / 100),
      criticalPerfect: String(scorer.counts[Judgement.CriticalPerfect]),
      perfect: String(scorer.counts[Judgement.Perfect]),
      great: String(scorer.counts[Judgement.Great]),
      good: String(scorer.counts[Judgement.Good]),
      miss: String(scorer.counts[Judgement.Miss]),
      osuAcc: String(modeAccuracy.value['osu-standard']),
      maniaAcc: String(modeAccuracy.value['mania']),
      taikoAcc: String(modeAccuracy.value['taiko']),
    },
  })
}
</script>

<template>
  <div class="play-view">
    <!-- Background image with blur -->
    <div 
      v-if="backgroundImageUrl" 
      class="background-image"
      :style="{ backgroundImage: `url(${backgroundImageUrl})` }"
    ></div>
    
    <!-- Fallback starfield background -->
    <div v-else class="starfield-background"></div>
    
    <!-- Dark overlay for better contrast -->
    <div class="background-overlay"></div>
    <div v-if="!started" class="overlay">
      <!-- 谱面元信息卡片 -->
      <div v-if="chart && status === '准备就绪'" class="chart-info-card">
        <div class="chart-cover" v-if="chart.meta.coverArt || backgroundImageUrl">
          <img :src="chart.meta.coverArt || backgroundImageUrl" alt="Cover" />
        </div>
        <div class="chart-details">
          <h2 class="chart-title">{{ chart.meta.title }}</h2>
          <p class="chart-artist">{{ chart.meta.artist }}</p>
          <div class="chart-meta-row" v-if="chart.meta.creator">
            <span class="meta-label">谱师:</span>
            <span class="meta-value">{{ chart.meta.creator }}</span>
          </div>
          <div class="chart-meta-row" v-if="chart.meta.version">
            <span class="meta-label">难度:</span>
            <span class="meta-value">{{ chart.meta.version }}</span>
          </div>
          <div class="chart-meta-row" v-if="chart.meta.source">
            <span class="meta-label">来源:</span>
            <span class="meta-value">{{ chart.meta.source }}</span>
          </div>
          <div class="chart-meta-row">
            <span class="meta-label">时长:</span>
            <span class="meta-value">{{ formatTime(chart.meta.length) }}</span>
          </div>
          <div class="chart-meta-row">
            <span class="meta-label">段落:</span>
            <span class="meta-value">{{ chart.segments.length }} 个</span>
          </div>
          <div class="chart-tags" v-if="chart.meta.tags && chart.meta.tags.length > 0">
            <span class="tag" v-for="tag in chart.meta.tags.slice(0, 5)" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
      
      <p class="status">{{ status }}</p>
      <div v-if="errorDetails" class="error-details-container">
        <button class="error-toggle-btn" @click="showErrorDetails = !showErrorDetails">
          {{ showErrorDetails ? '隐藏详情' : '显示详情' }}
        </button>
        <pre v-if="showErrorDetails" class="error-details">{{ errorDetails }}</pre>
      </div>
      <button
        v-if="status === '准备就绪'"
        class="start-btn"
        @click="startGame"
      >
        点击开始
      </button>
      <button class="back-btn" @click="router.push('/')">返回</button>
    </div>

    <!-- 顶部中央：ACC 指示器 -->
    <div v-if="started" class="hud-top-acc">
      <div class="acc-label">ACC</div>
      <div class="acc-meter">
        <svg class="acc-gauge" viewBox="0 0 400 80" width="400" height="80">
          <!-- 背景刻度线 -->
          <g class="scale-marks">
            <!-- 主刻度线 (每 10ms) -->
            <line v-for="i in 21" :key="'major-' + i"
                  :x1="(i - 1) * 20"
                  :y1="i === 11 ? 25 : 30"
                  :x2="(i - 1) * 20"
                  :y2="50"
                  :stroke="i === 11 ? '#00ff88' : 'rgba(255,255,255,0.3)'"
                  :stroke-width="i === 11 ? 3 : 2"/>
            
            <!-- 次刻度线 (每 5ms) -->
            <line v-for="i in 40" :key="'minor-' + i"
                  v-if="i % 2 === 0"
                  :x1="(i - 1) * 10"
                  :y1="35"
                  :x2="(i - 1) * 10"
                  :y2="50"
                  stroke="rgba(255,255,255,0.15)"
                  stroke-width="1"/>
          </g>
          
          <!-- 刻度标签 -->
          <g class="scale-labels">
            <text x="0" y="65" fill="rgba(255,255,255,0.5)" font-size="10" text-anchor="middle">-100</text>
            <text x="100" y="65" fill="rgba(255,255,255,0.5)" font-size="10" text-anchor="middle">-50</text>
            <text x="200" y="65" fill="#00ff88" font-size="12" text-anchor="middle" font-weight="bold">0</text>
            <text x="300" y="65" fill="rgba(255,255,255,0.5)" font-size="10" text-anchor="middle">+50</text>
            <text x="400" y="65" fill="rgba(255,255,255,0.5)" font-size="10" text-anchor="middle">+100</text>
          </g>
          
          <!-- 中心线 -->
          <line x1="200" y1="20" x2="200" y2="55" stroke="#00ff88" stroke-width="2" opacity="0.5"/>
          
          <!-- 指针 (根据 accOffset 移动) -->
          <g v-if="accVisible" :transform="`translate(${200 + Math.max(-200, Math.min(200, accOffset * 2))}, 0)`">
            <!-- 指针线 -->
            <line x1="0" y1="15" x2="0" y2="55" 
                  :stroke="getOffsetColor(accOffset)" 
                  stroke-width="3"
                  :style="{ filter: `drop-shadow(0 0 6px ${getOffsetColor(accOffset)})` }"/>
            <!-- 指针三角形 -->
            <path d="M -6 15 L 0 8 L 6 15 Z" 
                  :fill="getOffsetColor(accOffset)"
                  :style="{ filter: `drop-shadow(0 0 4px ${getOffsetColor(accOffset)})` }"/>
            <!-- 指针圆点 -->
            <circle cx="0" cy="55" r="4" :fill="getOffsetColor(accOffset)"/>
          </g>
          
          <!-- 偏移值显示 -->
          <text v-if="accVisible" 
                :x="200 + Math.max(-200, Math.min(200, accOffset * 2))" 
                y="75" 
                :fill="getOffsetColor(accOffset)" 
                font-size="11" 
                text-anchor="middle" 
                font-weight="bold">
            {{ accOffset > 0 ? '+' : '' }}{{ Math.round(accOffset) }}ms
          </text>
        </svg>
      </div>
      <div class="acc-value" :class="getResonanceClass(accuracy)">{{ accuracy.toFixed(2) }}%</div>
    </div>

    <!-- 左侧：整合的状态指示器 -->
    <div v-if="started" class="hud-left">
      <!-- 全局准确率 -->
      <div class="global-acc-section">
        <div class="section-title">⚡ 星域共振</div>
        <div class="resonance-bar-container">
          <div class="resonance-bar">
            <div class="resonance-fill" :class="getResonanceClass(accuracy)" :style="{ width: accuracy + '%' }"></div>
          </div>
          <div class="resonance-status" :class="getResonanceClass(accuracy)">{{ getResonanceStatus(accuracy) }}</div>
        </div>
      </div>
      
      <!-- 三模式准确率 -->
      <div class="modes-acc-section">
        <div class="freq-monitor">
          <div class="freq-label">🎯 OSU! <span class="freq-acc">{{ (modeAccuracy['osu-standard'] || 0).toFixed(1) }}%</span></div>
          <div class="freq-bar"><div class="freq-fill freq-high" :style="{ width: (modeAccuracy['osu-standard'] || 0) + '%' }"></div></div>
        </div>
        <div class="freq-monitor">
          <div class="freq-label">🎹 MANIA <span class="freq-acc">{{ (modeAccuracy['mania'] || 0).toFixed(1) }}%</span></div>
          <div class="freq-bar"><div class="freq-fill freq-mid" :style="{ width: (modeAccuracy['mania'] || 0) + '%' }"></div></div>
        </div>
        <div class="freq-monitor">
          <div class="freq-label">🥁 TAIKO <span class="freq-acc">{{ (modeAccuracy['taiko'] || 0).toFixed(1) }}%</span></div>
          <div class="freq-bar"><div class="freq-fill freq-low" :style="{ width: (modeAccuracy['taiko'] || 0) + '%' }"></div></div>
        </div>
      </div>
    </div>

    <!-- 右侧：全局分数和连击 -->
    <div v-if="started" class="hud-right">
      <div class="mode-badge" :style="{ background: MODE_COLORS[activeMode] || 'var(--astro-nebula-purple)' }">{{ activeMode.toUpperCase() }}</div>
      <div class="combo" :class="{ 'combo-active': combo > 0 }">{{ combo }}<span style="font-size:1.2rem; margin-left:4px">x</span></div>
      <div class="score-display">{{ String(score).padStart(8, '0') }}</div>
      <div
        v-if="lastJudge !== null"
        class="judge-display"
        :key="combo + '-' + lastJudge"
        :style="{ color: JUDGE_COLORS[lastJudge] || '#fff', ...((lastJudge === 0 || lastJudge === 1) ? { textShadow: '0 0 20px ' + JUDGE_COLORS[lastJudge] } : {}) }"
      >
        {{ JUDGE_LABELS[lastJudge] }}
      </div>
    </div>

    <!-- 右侧：切换指示器 -->
    <div v-if="started && transitionInfo && transitionInfo.timeUntilTransition < 3000" class="transition-indicator-right">
      <div class="transition-header">NEXT MODE</div>
      <div class="transition-mode" :style="{ color: MODE_COLORS[transitionInfo.nextMode] || '#4a9eff' }">
        {{ transitionInfo.nextMode.toUpperCase() }}
      </div>
      <div class="transition-time">{{ Math.ceil(transitionInfo.timeUntilTransition / 1000) }}s</div>
      <div class="transition-keys">
        <div class="key-hint" v-for="(key, idx) in transitionInfo.keyBindings.slice(0, 4)" :key="idx">
          {{ key }}
        </div>
      </div>
    </div>

    <!-- Scroll speed indicator -->
    <div v-if="scrollSpeedDisplay" class="scroll-speed-indicator">
      <div class="speed-icon">⚡</div>
      <div class="speed-text">{{ scrollSpeedDisplay }}</div>
      <div class="speed-label">SCROLL SPEED</div>
    </div>

    <!-- Auto-play indicator -->
    <div v-if="showAutoPlayIndicator" class="auto-play-indicator">
      <div class="auto-icon">🤖</div>
      <div class="auto-text">{{ autoPlayEnabled ? 'AUTO-PLAY ON' : 'AUTO-PLAY OFF' }}</div>
      <div class="auto-hint">Press TAB to toggle</div>
    </div>

    <!-- Auto-play status badge (always visible when enabled) -->
    <div v-if="started && autoPlayEnabled" class="auto-play-badge">
      <span class="auto-badge-icon">🤖</span>
      <span class="auto-badge-text">AUTO</span>
    </div>

    <!-- Transition flash overlay -->
    <div 
      v-if="showTransitionFlash" 
      class="transition-flash"
      :style="{ backgroundColor: transitionFlashColor }"
    ></div>

    <div v-if="debug && started" class="debug-panel">
      <div>FPS: {{ debugInfo.fps }}</div>
      <div>songMs: {{ debugInfo.songMs }}</div>
      <div>segment: {{ debugInfo.segId }}</div>
      <div>mode: {{ debugInfo.mode }}</div>
      <div>combo: {{ combo }} / max: {{ scorer?.maxCombo }}</div>
      <div style="color: var(--astro-plasma-cyan); margin-top: 8px;">Auto-play: {{ autoPlayEnabled ? 'ON' : 'OFF' }}</div>
    </div>

    <canvas ref="canvasRef" width="1000" height="700" class="game-canvas" />
  </div>
</template>

<style scoped>
.play-view {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background: var(--astro-bg-gradient);
  overflow: hidden;
}

/* Background image with blur */
.background-image {
  position: fixed;
  top: -20px;
  left: -20px;
  width: calc(100% + 40px);
  height: calc(100% + 40px);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(20px) brightness(0.4);
  z-index: 0;
  transform: scale(1.1);
}

/* Fallback starfield background */
.starfield-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--astro-bg-gradient);
  z-index: 0;
}

.starfield-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(2px 2px at 10% 20%, rgba(255,255,255,0.8), transparent),
    radial-gradient(2px 2px at 90% 80%, rgba(0,217,255,0.6), transparent),
    radial-gradient(1px 1px at 50% 50%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 70% 30%, rgba(107,76,230,0.5), transparent),
    radial-gradient(2px 2px at 30% 70%, rgba(255,255,255,0.7), transparent);
  background-size: 300% 300%;
  animation: starfield 180s linear infinite;
  opacity: 0.5;
}

/* Dark overlay for better contrast */
.background-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 0;
}

/* Remove old ::before pseudo-element */

.overlay {
  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  background: var(--astro-panel-bg);
  backdrop-filter: blur(10px);
  padding: 40px 60px;
  border-radius: 16px;
  border: 1px solid rgba(107, 76, 230, 0.3);
  box-shadow: var(--astro-glow-purple), 0 20px 60px rgba(0, 0, 0, 0.6);
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
}

/* 谱面信息卡片 */
.chart-info-card {
  display: flex;
  gap: 24px;
  background: rgba(20, 25, 45, 0.6);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid rgba(107, 76, 230, 0.2);
  max-width: 600px;
  width: 100%;
}

.chart-cover {
  flex-shrink: 0;
  width: 150px;
  height: 150px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(107, 76, 230, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.chart-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chart-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--astro-star-white);
  margin: 0;
  text-shadow: 0 0 10px rgba(107, 76, 230, 0.5);
  line-height: 1.3;
}

.chart-artist {
  font-size: 1.1rem;
  color: var(--astro-plasma-cyan);
  margin: 0 0 8px 0;
  font-weight: 500;
}

.chart-meta-row {
  display: flex;
  gap: 8px;
  font-size: 0.9rem;
  line-height: 1.6;
}

.meta-label {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  min-width: 50px;
}

.meta-value {
  color: var(--astro-star-white);
  font-weight: 400;
}

.chart-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tag {
  background: rgba(107, 76, 230, 0.2);
  color: var(--astro-plasma-cyan);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(107, 76, 230, 0.3);
}

.status {
  color: var(--astro-star-white);
  font-size: 1.3rem;
  font-weight: 500;
  text-shadow: 0 0 10px rgba(107, 76, 230, 0.5);
  letter-spacing: 1px;
}

.error-details-container {
  margin-top: 16px;
  max-width: min(600px, 80vw);
}

.error-toggle-btn {
  padding: 8px 16px;
  font-size: 0.9rem;
  background: #3a3a5e;
  color: #fff;
  border: 1px solid #4a4a6e;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 8px;
}

.error-toggle-btn:hover {
  background: #4a4a6e;
}

.error-details {
  background: #1a1a2e;
  color: #ff8888;
  padding: 16px;
  border-radius: 4px;
  border: 1px solid #ff4444;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  text-align: left;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.error-details::-webkit-scrollbar {
  width: 8px;
}

.error-details::-webkit-scrollbar-track {
  background: #0f0f1f;
}

.error-details::-webkit-scrollbar-thumb {
  background: #3a3a5e;
  border-radius: 4px;
}

.error-details::-webkit-scrollbar-thumb:hover {
  background: #4a4a6e;
}

.start-btn {
  padding: 18px 60px;
  font-size: 1.4rem;
  font-weight: 600;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--astro-glow-purple);
  text-transform: uppercase;
  letter-spacing: 2px;
  position: relative;
  overflow: hidden;
}

.start-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s;
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(107, 76, 230, 0.8), 0 0 60px rgba(0, 217, 255, 0.4);
}

.start-btn:hover::before {
  left: 100%;
}

.back-btn {
  padding: 10px 30px;
  font-size: 1rem;
  background: rgba(30, 35, 60, 0.6);
  color: var(--astro-plasma-cyan);
  border: 1px solid rgba(0, 217, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.back-btn:hover {
  background: rgba(30, 35, 60, 0.9);
  border-color: var(--astro-plasma-cyan);
  box-shadow: var(--astro-glow-cyan);
}

.game-canvas {
  border: 2px solid rgba(107, 76, 230, 0.5);
  border-radius: 8px;
  box-shadow: 
    var(--astro-glow-purple),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
  /* Enable hardware acceleration for high refresh rate */
  transform: translateZ(0);
  will-change: transform;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  position: relative;
  z-index: 1;
  /* 更大的 Canvas 尺寸 */
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
}

.hud {
  position: absolute;
  top: 20px;
  right: 20px;
  text-align: right;
  z-index: 5;
  background: var(--astro-glass-bg);
  backdrop-filter: blur(10px);
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid rgba(107, 76, 230, 0.3);
  box-shadow: var(--astro-glow-purple);
}

.mode-badge {
  display: inline-block;
  padding: 6px 16px;
  background: linear-gradient(135deg, var(--astro-nebula-purple), var(--astro-plasma-cyan));
  color: #fff;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  box-shadow: 0 0 15px rgba(107, 76, 230, 0.6);
  animation: pulse-glow 2s ease-in-out infinite;
}

.combo {
  font-size: 2.2rem;
  color: var(--astro-signal-green);
  font-weight: bold;
  text-shadow: var(--astro-glow-green);
  font-family: var(--mono);
}

.acc {
  font-size: 1.3rem;
  color: var(--astro-plasma-cyan);
  text-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
  font-family: var(--mono);
}

.score-display {
  font-size: 1.1rem;
  color: var(--astro-star-white);
  margin-top: 6px;
  opacity: 0.9;
  font-family: var(--mono);
}

.judge-display {
  font-size: 1.6rem;
  font-weight: bold;
  margin-top: 12px;
  text-shadow: 0 0 15px currentColor;
  animation: pulse-glow 0.3s ease-out;
}

.debug-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(10, 14, 26, 0.9);
  color: var(--astro-signal-green);
  font-family: var(--mono);
  font-size: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  z-index: 5;
  line-height: 1.8;
  border: 1px solid rgba(0, 255, 136, 0.3);
  box-shadow: var(--astro-glow-green);
  backdrop-filter: blur(5px);
}

.debug-panel div {
  opacity: 0.9;
}

.debug-panel div:first-child {
  color: var(--astro-plasma-cyan);
  font-weight: bold;
  margin-bottom: 4px;
}

.transition-flash {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  pointer-events: none;
  animation: flash-fade 0.2s ease-out forwards;
}

@keyframes flash-fade {
  0% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
  }
}

/* Scroll speed indicator */
.scroll-speed-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
  background: rgba(10, 14, 26, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 24px 40px;
  border: 2px solid rgba(107, 76, 230, 0.5);
  box-shadow: 
    0 0 40px rgba(107, 76, 230, 0.6),
    0 8px 32px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  animation: fadeInScale 0.2s ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.speed-icon {
  font-size: 2.5rem;
  animation: pulse 0.5s ease-in-out infinite;
}

.speed-text {
  font-size: 3rem;
  font-weight: 900;
  color: var(--astro-plasma-cyan);
  font-family: 'Consolas', monospace;
  text-shadow: 0 0 20px rgba(0, 217, 255, 0.8);
  line-height: 1;
}

.speed-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  letter-spacing: 2px;
  margin-top: 4px;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* Auto-play indicator */
.auto-play-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
  background: rgba(10, 14, 26, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 24px 40px;
  border: 2px solid rgba(0, 217, 255, 0.5);
  box-shadow: 
    0 0 40px rgba(0, 217, 255, 0.6),
    0 8px 32px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  animation: fadeInScale 0.2s ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.auto-icon {
  font-size: 2.5rem;
  animation: pulse 0.5s ease-in-out infinite;
}

.auto-text {
  font-size: 2rem;
  font-weight: 900;
  color: var(--astro-plasma-cyan);
  font-family: 'Consolas', monospace;
  text-shadow: 0 0 20px rgba(0, 217, 255, 0.8);
  line-height: 1;
}

.auto-hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  letter-spacing: 2px;
  margin-top: 4px;
}

/* Auto-play status badge */
.auto-play-badge {
  position: absolute;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(107, 76, 230, 0.2));
  backdrop-filter: blur(10px);
  padding: 8px 20px;
  border-radius: 20px;
  border: 2px solid rgba(0, 217, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.4);
  display: flex;
  align-items: center;
  gap: 8px;
  animation: pulse-glow 2s ease-in-out infinite;
}

.auto-badge-icon {
  font-size: 1.2rem;
}

.auto-badge-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: var(--astro-plasma-cyan);
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(0, 217, 255, 0.6);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* 响应式适配 - 平板 */
@media (max-width: 1024px) {
  .overlay {
    padding: 32px 48px;
  }

  .start-btn {
    padding: 16px 48px;
    font-size: 1.2rem;
  }

  .hud {
    top: 16px;
    right: 16px;
    padding: 12px 16px;
  }

  .combo {
    font-size: 1.8rem;
  }

  .acc {
    font-size: 1.1rem;
  }

  .score-display {
    font-size: 1rem;
  }

  .judge-display {
    font-size: 1.4rem;
  }
}

/* 响应式适配 - 手机横屏 */
@media (max-width: 768px) and (orientation: landscape) {
  .overlay {
    padding: 24px 36px;
    gap: 12px;
  }

  .status {
    font-size: 1.1rem;
  }

  .start-btn {
    padding: 14px 40px;
    font-size: 1.1rem;
  }

  .back-btn {
    padding: 8px 24px;
    font-size: 0.9rem;
  }

  .hud {
    top: 12px;
    right: 12px;
    padding: 10px 14px;
  }

  .mode-badge {
    padding: 4px 12px;
    font-size: 0.75rem;
    margin-bottom: 8px;
  }

  .combo {
    font-size: 1.6rem;
  }

  .acc {
    font-size: 1rem;
  }

  .score-display {
    font-size: 0.9rem;
  }

  .judge-display {
    font-size: 1.2rem;
    margin-top: 8px;
  }

  .debug-panel {
    top: 12px;
    left: 12px;
    padding: 8px 12px;
    font-size: 10px;
  }

  .game-canvas {
    max-width: 98vw;
    max-height: 90vh;
  }
}

/* 响应式适配 - 手机竖屏（显示旋转提示） */
@media (max-width: 768px) and (orientation: portrait) {
  .play-view {
    filter: blur(5px);
  }

  .overlay,
  .hud,
  .debug-panel,
  .game-canvas {
    opacity: 0.3;
    pointer-events: none;
  }
}

/* 超大屏幕优化 */
@media (min-width: 1920px) {
  .game-canvas {
    max-width: 1600px;
    max-height: 1000px;
  }

  .hud {
    top: 32px;
    right: 32px;
    padding: 20px 24px;
  }

  .combo {
    font-size: 2.6rem;
  }

  .acc {
    font-size: 1.5rem;
  }

  .score-display {
    font-size: 1.3rem;
  }
}
  /* 顶部 ACC 指示器 */
  .hud-top-acc { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); z-index: 5; background: var(--astro-panel-bg); backdrop-filter: blur(10px); padding: 16px 32px; border-radius: 16px; border: 2px solid rgba(107, 76, 230, 0.5); box-shadow: var(--astro-glow-purple); display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .acc-label { color: rgba(255, 255, 255, 0.7); font-size: 0.75rem; letter-spacing: 2px; font-weight: 600; text-transform: uppercase; }
  .acc-meter { position: relative; width: 400px; height: 80px; }
  .acc-gauge { display: block; }
  .acc-value { font-family: var(--mono); font-weight: 900; font-size: 1.5rem; text-shadow: 0 0 20px currentColor; line-height: 1; margin-top: 4px; }
  
  /* 左侧整合指示器 */
  .hud-left { position: absolute; top: 50%; left: 20px; transform: translateY(-50%); z-index: 5; background: var(--astro-glass-bg); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; border: 1px solid rgba(0, 217, 255, 0.3); box-shadow: var(--astro-glow-cyan); display: flex; flex-direction: column; gap: 20px; min-width: 200px; }
  
  .global-acc-section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
  .section-title { color: var(--astro-star-white); font-size: 0.9rem; font-weight: 600; letter-spacing: 1px; }
  .resonance-bar-container { display: flex; flex-direction: column; gap: 6px; }
  .resonance-bar { width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; }
  .resonance-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease, background 0.3s ease; box-shadow: 0 0 10px currentColor; }
  .resonance-status { font-family: var(--mono); font-size: 0.8rem; font-weight: bold; letter-spacing: 1px; text-align: center; }
  .status-perfect { color: var(--status-perfect); }
  .status-stable { color: var(--status-stable); }
  .status-warning { color: var(--status-warning); }
  .status-critical { color: var(--status-critical); }
  
  .modes-acc-section { display: flex; flex-direction: column; gap: 12px; }
  .freq-monitor { display: flex; flex-direction: column; gap: 4px; }
  .freq-label { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--astro-star-white); font-weight: 500; letter-spacing: 0.5px; }
  .freq-acc { font-family: var(--mono); opacity: 0.8; }
  .freq-bar { width: 100%; height: 6px; background: rgba(0, 0, 0, 0.5); border-radius: 3px; overflow: hidden; }
  .freq-fill { height: 100%; transition: width 0.3s ease; }
  .freq-high { background: var(--freq-high); box-shadow: 0 0 8px var(--freq-high); }
  .freq-mid { background: var(--freq-mid); box-shadow: 0 0 8px var(--freq-mid); }
  .freq-low { background: var(--freq-low); box-shadow: 0 0 8px var(--freq-low); }
  .hud-right { position: absolute; top: 20px; right: 20px; z-index: 5; background: var(--astro-glass-bg); backdrop-filter: blur(10px); padding: 16px 20px; border-radius: 12px; border: 1px solid rgba(107, 76, 230, 0.3); box-shadow: var(--astro-glow-purple); text-align: right; }
  .combo-active { animation: pulse-glow 1s infinite alternate; }
  
  /* 右侧切换指示器 */
  .transition-indicator-right { position: absolute; top: 50%; right: 20px; transform: translateY(-50%); z-index: 5; background: var(--astro-panel-bg); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; border: 2px solid rgba(107, 76, 230, 0.5); box-shadow: var(--astro-glow-purple); display: flex; flex-direction: column; align-items: center; gap: 12px; min-width: 150px; animation: pulse-glow 2s ease-in-out infinite; }
  .transition-header { color: rgba(255, 255, 255, 0.7); font-size: 0.75rem; letter-spacing: 2px; font-weight: 600; }
  .transition-mode { font-size: 1.5rem; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 20px currentColor; }
  .transition-time { font-family: var(--mono); font-size: 2rem; font-weight: 900; color: var(--astro-plasma-cyan); text-shadow: 0 0 20px rgba(0, 217, 255, 0.8); }
  .transition-keys { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }
  .key-hint { background: rgba(255, 255, 255, 0.1); padding: 6px 12px; border-radius: 6px; font-family: var(--mono); font-size: 0.85rem; font-weight: bold; color: var(--astro-star-white); border: 1px solid rgba(255, 255, 255, 0.2); }
</style>
