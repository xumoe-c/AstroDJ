<template>
  <div class="segment-editor">
    <div class="header">
      <h2>📝 段落管理</h2>
      <button 
        v-if="segments.length > 1" 
        @click="handleAutoStitch" 
        class="stitch-btn"
      >
        🔗 自动拼接
      </button>
    </div>

    <div class="stats">
      <span>段落总数: {{ segments.length }}</span>
      <span>总时长: {{ formatTime(totalDuration) }}</span>
    </div>

    <div v-if="segments.length === 0" class="empty">
      请从谱面列表中添加段落
    </div>

    <div v-else class="segment-list">
      <div 
        v-for="(segment, index) in segments" 
        :key="segment.id"
        class="segment-card"
      >
        <div class="segment-header">
          <span class="segment-number">#{{ index + 1 }}</span>
          <span :class="`mode-badge mode-${segment.mode}`">
            {{ segment.mode }}
          </span>
          <button @click="removeSegment(index)" class="remove-btn">
            ✕
          </button>
        </div>
        <div class="segment-info">
          <div class="info-row">
            <span class="label">时间范围:</span>
            <span class="value">{{ segment.startMs }}ms - {{ segment.endMs }}ms</span>
          </div>
          <div class="info-row">
            <span class="label">时长:</span>
            <span class="value">{{ formatTime(segment.endMs - segment.startMs) }}</span>
          </div>
          <div class="info-row">
            <span class="label">音符数:</span>
            <span class="value">{{ segment.notes.length }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Segment } from '../../game/types'
import { SegmentBuilder } from '../services/segment-builder'

const props = defineProps<{
  segments: Segment[]
}>()

const emit = defineEmits<{
  update: [segments: Segment[]]
  remove: [index: number]
}>()

const builder = new SegmentBuilder()

const totalDuration = computed(() => {
  if (props.segments.length === 0) return 0
  const last = props.segments[props.segments.length - 1]
  return last.endMs
})

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function handleAutoStitch() {
  const stitched = builder.autoStitch(props.segments)
  emit('update', stitched)
}

function removeSegment(index: number) {
  emit('remove', index)
}
</script>

<style scoped>
.segment-editor {
  padding: 32px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.segment-editor h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.stitch-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.stitch-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
}

.stitch-btn:active {
  transform: translateY(0);
}

.stats {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.stats span {
  font-size: 14px;
  color: #333;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stats span::before {
  content: '📊';
  font-size: 16px;
}

.empty {
  padding: 60px 40px;
  text-align: center;
  color: #999;
  border: 2px dashed #ddd;
  border-radius: 12px;
  font-size: 15px;
}

.segment-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 500px;
  overflow-y: auto;
  padding-right: 8px;
}

.segment-list::-webkit-scrollbar {
  width: 6px;
}

.segment-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.segment-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
}

.segment-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.segment-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.segment-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
  transform: translateX(4px);
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.segment-number {
  font-weight: 700;
  font-size: 20px;
  color: #667eea;
  min-width: 32px;
}

.mode-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mode-mania {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
  border: 1px solid #90caf9;
}

.mode-taiko {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);
  color: #c2185b;
  border: 1px solid #f48fb1;
}

.remove-btn {
  margin-left: auto;
  padding: 6px 12px;
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.remove-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
}

.segment-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 44px;
}

.info-row {
  display: flex;
  gap: 12px;
  font-size: 14px;
  align-items: center;
}

.label {
  color: #666;
  min-width: 90px;
  font-weight: 500;
}

.value {
  color: #333;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

/* 响应式 */
@media (max-width: 768px) {
  .segment-editor {
    padding: 20px;
  }
  
  .stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .segment-info {
    padding-left: 0;
  }
}
</style>
