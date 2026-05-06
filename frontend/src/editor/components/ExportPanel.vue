<template>
  <div class="export-panel">
    <h2>🚀 导出混合谱面</h2>

    <div class="form">
      <div class="form-group">
        <label for="title">
          <span class="label-icon">🎵</span>
          标题
        </label>
        <input
          id="title"
          type="text"
          v-model="title"
          placeholder="输入谱面标题"
        />
      </div>

      <div class="form-group">
        <label for="artist">
          <span class="label-icon">🎤</span>
          艺术家
        </label>
        <input
          id="artist"
          type="text"
          v-model="artist"
          placeholder="输入艺术家名称"
        />
      </div>

      <div class="form-group">
        <label>
          <span class="label-icon">🎧</span>
          音频文件
        </label>
        <div class="audio-info">
          {{ audioFileName || '未选择音频文件' }}
        </div>
      </div>
    </div>

    <div v-if="errors.length > 0" class="errors">
      <h3>⚠️ 验证错误</h3>
      <div class="error-list">
        <div v-for="(error, index) in errors" :key="index" class="error-item">
          {{ error.message }}
        </div>
      </div>
    </div>

    <div class="actions">
      <button 
        @click="handleExport" 
        :disabled="!canExport || exporting"
        class="export-btn"
      >
        <span v-if="exporting">⏳ 导出中...</span>
        <span v-else>📦 导出混合谱面</span>
      </button>
    </div>

    <div v-if="downloadUrl" class="success">
      <p>✓ 导出成功！</p>
      <a :href="downloadUrl" :download="downloadFileName" class="download-link">
        ⬇️ 点击下载
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Segment, ValidationError } from '../../game/types'
import type { ParsedOsz } from '../types'
import { ChartExporter } from '../services/chart-exporter'
import { ZipPackager } from '../services/zip-packager'

const props = defineProps<{
  segments: Segment[]
  audioFile: File | null
  audioFileName: string
  oszData?: ParsedOsz | null
}>()

const title = ref('')
const artist = ref('')
const errors = ref<ValidationError[]>([])
const exporting = ref(false)
const downloadUrl = ref('')
const downloadFileName = ref('')

const exporter = new ChartExporter()
const packager = new ZipPackager()

const canExport = computed(() => {
  return props.segments.length > 0 && 
         props.audioFile !== null && 
         title.value.trim() !== '' &&
         artist.value.trim() !== ''
})

async function handleExport() {
  if (!canExport.value) return

  exporting.value = true
  errors.value = []
  downloadUrl.value = ''

  try {
    // Export chart
    const result = exporter.export(props.segments, {
      title: title.value,
      artist: artist.value,
      audioFileName: props.audioFileName
    }, props.oszData || undefined)

    if (!result.ok) {
      errors.value = result.error
      exporting.value = false
      return
    }

    const chartJSON = exporter.toJSON(result.value)

    // Package as ZIP with cover art and background
    const zipBlob = await packager.package(
      chartJSON,
      props.audioFile!,
      title.value,
      props.oszData?.coverArt || null,
      props.oszData?.backgroundImage || null
    )

    // Create download URL
    downloadUrl.value = URL.createObjectURL(zipBlob)
    downloadFileName.value = `${title.value.replace(/[^a-z0-9]/gi, '_')}.zip`

    // Auto download
    const link = document.createElement('a')
    link.href = downloadUrl.value
    link.download = downloadFileName.value
    link.click()

  } catch (error) {
    errors.value = [{
      type: 'validation',
      message: `导出失败: ${error}`
    }]
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.export-panel {
  padding: 32px;
}

.export-panel h2 {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-icon {
  font-size: 18px;
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.2s;
  font-weight: 500;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:hover {
  border-color: #bbb;
}

.audio-info {
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 10px;
  color: #667eea;
  font-size: 14px;
  font-weight: 600;
  border: 2px solid rgba(102, 126, 234, 0.2);
}

.errors {
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  border-radius: 12px;
  border-left: 4px solid #c62828;
}

.errors h3 {
  margin: 0 0 16px 0;
  color: #c62828;
  font-size: 16px;
  font-weight: 700;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-item {
  color: #c62828;
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  font-weight: 500;
}

.actions {
  display: flex;
  justify-content: center;
}

.export-btn {
  padding: 16px 48px;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
}

.export-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(76, 175, 80, 0.5);
}

.export-btn:active:not(:disabled) {
  transform: translateY(0);
}

.export-btn:disabled {
  background: linear-gradient(135deg, #ccc 0%, #bbb 100%);
  cursor: not-allowed;
  box-shadow: none;
  opacity: 0.6;
}

.success {
  margin-top: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-radius: 12px;
  text-align: center;
  border-left: 4px solid #2e7d32;
}

.success p {
  margin: 0 0 16px 0;
  color: #2e7d32;
  font-weight: 700;
  font-size: 16px;
}

.download-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-decoration: none;
  border-radius: 10px;
  font-weight: 700;
  transition: all 0.2s;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.download-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
}

.download-link:active {
  transform: translateY(0);
}

/* 响应式 */
@media (max-width: 768px) {
  .export-panel {
    padding: 20px;
  }
  
  .export-btn {
    padding: 14px 32px;
    font-size: 15px;
  }
}
</style>
