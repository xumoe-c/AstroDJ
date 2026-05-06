<template>
  <div class="beatmap-list">
    <h2>🎼 谱面列表</h2>
    <p class="hint">为每个谱面标记入点和出点时间（毫秒）</p>

    <div v-if="beatmaps.length === 0" class="empty">
      请先导入 .osz 文件
    </div>

    <table v-else class="beatmap-table">
      <thead>
        <tr>
          <th>难度</th>
          <th>模式</th>
          <th>入点 (ms)</th>
          <th>出点 (ms)</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="beatmap in beatmaps" :key="beatmap.id">
          <td class="difficulty-cell">{{ beatmap.difficulty }}</td>
          <td>
            <span :class="`mode-badge mode-${beatmap.mode}`">
              {{ beatmap.mode }}
            </span>
          </td>
          <td>
            <div class="time-input-group">
              <input
                type="number"
                v-model.number="timeRanges[beatmap.id].startMs"
                min="0"
                step="1000"
                placeholder="0"
              />
              <span class="time-unit">ms</span>
            </div>
          </td>
          <td>
            <div class="time-input-group">
              <input
                type="number"
                v-model.number="timeRanges[beatmap.id].endMs"
                min="0"
                step="1000"
                placeholder="60000"
              />
              <span class="time-unit">ms</span>
            </div>
          </td>
          <td>
            <button @click="addSegment(beatmap)" class="add-btn">
              ➕ 添加
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ParsedBeatmap, SegmentConfig } from '../types'
import { SegmentBuilder } from '../services/segment-builder'

const props = defineProps<{
  beatmaps: ParsedBeatmap[]
}>()

const emit = defineEmits<{
  segmentAdded: [segment: any, config: SegmentConfig]
}>()

const timeRanges = ref<Record<string, { startMs: number; endMs: number }>>({})
const builder = new SegmentBuilder()

// Initialize time ranges when beatmaps change
watch(() => props.beatmaps, (newBeatmaps) => {
  newBeatmaps.forEach(beatmap => {
    if (!timeRanges.value[beatmap.id]) {
      timeRanges.value[beatmap.id] = { startMs: 0, endMs: 60000 }
    }
  })
}, { immediate: true })

function addSegment(beatmap: ParsedBeatmap) {
  const range = timeRanges.value[beatmap.id]
  
  if (range.startMs >= range.endMs) {
    alert('入点时间必须小于出点时间')
    return
  }

  const config: SegmentConfig = {
    id: `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    beatmapId: beatmap.id,
    startMs: range.startMs,
    endMs: range.endMs,
    order: 0
  }

  const result = builder.buildSegment(beatmap, config)

  if (result.ok) {
    emit('segmentAdded', result.value, config)
  } else {
    alert(`添加失败: ${result.error}`)
  }
}
</script>

<style scoped>
.beatmap-list {
  padding: 32px;
}

.beatmap-list h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.hint {
  color: #666;
  margin-bottom: 24px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint::before {
  content: '💡';
  font-size: 18px;
}

.empty {
  padding: 60px 40px;
  text-align: center;
  color: #999;
  font-size: 15px;
}

.beatmap-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  overflow: hidden;
}

.beatmap-table thead {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.beatmap-table th {
  padding: 16px 12px;
  text-align: left;
  color: white;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.beatmap-table th:first-child {
  border-radius: 0;
}

.beatmap-table th:last-child {
  border-radius: 0;
}

.beatmap-table tbody tr {
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s;
}

.beatmap-table tbody tr:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.beatmap-table tbody tr:last-child {
  border-bottom: none;
}

.beatmap-table td {
  padding: 16px 12px;
  color: #333;
  font-size: 14px;
}

.difficulty-cell {
  font-weight: 600;
  color: #667eea;
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

.time-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

input[type="number"] {
  width: 110px;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  font-family: 'Courier New', monospace;
}

input[type="number"]:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

input[type="number"]:hover {
  border-color: #bbb;
}

.time-unit {
  font-size: 12px;
  color: #999;
  font-weight: 500;
}

.add-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.add-btn:active {
  transform: translateY(0);
}

/* 响应式 */
@media (max-width: 1200px) {
  .beatmap-table {
    font-size: 13px;
  }
  
  input[type="number"] {
    width: 90px;
    padding: 8px 10px;
  }
  
  .add-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .beatmap-list {
    padding: 20px;
  }
  
  .beatmap-table {
    display: block;
    overflow-x: auto;
  }
}
</style>
