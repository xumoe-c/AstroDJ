<template>
  <div class="editor-page">
    <header class="editor-header">
      <div class="header-content">
        <h1>🎵 混合谱面编辑器</h1>
        <div class="header-actions">
          <div v-if="state.segments.length > 0" class="progress-indicator">
            <span class="progress-label">段落数</span>
            <span class="progress-value">{{ state.segments.length }}</span>
          </div>
          <router-link to="/" class="back-link">← 返回主页</router-link>
        </div>
      </div>
    </header>

    <main class="editor-main">
      <!-- 左侧工作区 -->
      <div class="workspace">
        <section class="section card">
          <OszImporter @imported="handleImported" />
        </section>

        <section v-if="state.parsedOsz" class="section card">
          <BeatmapList 
            :beatmaps="state.parsedOsz.beatmaps"
            @segment-added="handleSegmentAdded"
          />
        </section>
      </div>

      <!-- 右侧面板 -->
      <aside v-if="state.segments.length > 0" class="sidebar">
        <section class="section card sticky">
          <SegmentEditor 
            :segments="state.segments"
            @update="handleSegmentsUpdate"
            @remove="handleSegmentRemove"
          />
        </section>

        <section v-if="state.parsedOsz" class="section card">
          <ExportPanel 
            :segments="state.segments"
            :audio-file="state.parsedOsz.audioFile"
            :audio-file-name="state.parsedOsz.audioFileName"
            :osz-data="state.parsedOsz"
          />
        </section>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import OszImporter from '../editor/components/OszImporter.vue'
import BeatmapList from '../editor/components/BeatmapList.vue'
import SegmentEditor from '../editor/components/SegmentEditor.vue'
import ExportPanel from '../editor/components/ExportPanel.vue'
import type { ParsedOsz, SegmentConfig } from '../editor/types'
import type { Segment } from '../game/types'

interface EditorState {
  parsedOsz: ParsedOsz | null
  segments: Segment[]
  segmentConfigs: Map<string, SegmentConfig>
}

const state = reactive<EditorState>({
  parsedOsz: null,
  segments: [],
  segmentConfigs: new Map()
})

function handleImported(data: ParsedOsz) {
  state.parsedOsz = data
  state.segments = []
  state.segmentConfigs.clear()
}

function handleSegmentAdded(segment: Segment, config: SegmentConfig) {
  state.segments.push(segment)
  state.segmentConfigs.set(config.id, config)
}

function handleSegmentsUpdate(segments: Segment[]) {
  state.segments = segments
}

function handleSegmentRemove(index: number) {
  state.segments.splice(index, 1)
}
</script>

<style scoped>
.editor-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-attachment: fixed;
}

.editor-header {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  padding: 0;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1800px;
  margin: 0 auto;
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 24px;
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  color: white;
}

.progress-label {
  font-size: 13px;
  opacity: 0.9;
}

.progress-value {
  font-size: 18px;
  font-weight: 700;
}

.back-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.2s;
  padding: 8px 16px;
  border-radius: 8px;
}

.back-link:hover {
  background: rgba(102, 126, 234, 0.1);
  transform: translateX(-2px);
}

.editor-main {
  max-width: 1800px;
  margin: 0 auto;
  padding: 32px 24px;
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 24px;
  align-items: start;
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  margin: 0;
}

.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}

.sticky {
  position: sticky;
  top: 100px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .editor-main {
    grid-template-columns: 1fr 380px;
  }
}

@media (max-width: 1200px) {
  .editor-main {
    grid-template-columns: 1fr;
    max-width: 900px;
  }
  
  .sidebar {
    grid-column: 1;
  }
  
  .sticky {
    position: static;
    max-height: none;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 16px 20px;
  }
  
  .editor-header h1 {
    font-size: 20px;
  }
  
  .progress-indicator {
    padding: 6px 12px;
  }
  
  .progress-value {
    font-size: 16px;
  }
  
  .editor-main {
    padding: 20px 16px;
  }
}

/* 滚动条美化 */
.sticky::-webkit-scrollbar {
  width: 8px;
}

.sticky::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.sticky::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
}

.sticky::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
}
</style>
