<template>
  <div class="osz-importer">
    <h2>📦 导入 .osz 文件</h2>
    <p class="subtitle">支持 osu! 标准谱面包格式</p>
    
    <div class="file-input-wrapper">
      <input
        type="file"
        accept=".osz"
        @change="handleFileSelect"
        ref="fileInput"
        id="osz-file-input"
      />
      <label for="osz-file-input" class="file-label">
        📁 选择 .osz 文件
      </label>
    </div>

    <div v-if="loading" class="loading">
      正在解析谱面...
    </div>

    <div v-if="error" class="error">
      ❌ {{ error }}
    </div>

    <div v-if="success" class="success">
      ✓ 解析成功！找到 {{ beatmapCount }} 个谱面，请在下方选择需要的段落
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { OszParser } from '../services/osz-parser'
import type { ParsedOsz } from '../types'

const emit = defineEmits<{
  imported: [data: ParsedOsz]
}>()

const fileInput = ref<HTMLInputElement>()
const loading = ref(false)
const error = ref('')
const success = ref(false)
const beatmapCount = ref(0)

const parser = new OszParser()

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return

  loading.value = true
  error.value = ''
  success.value = false

  const result = await parser.parse(file)

  loading.value = false

  if (result.ok) {
    success.value = true
    beatmapCount.value = result.value.beatmaps.length
    emit('imported', result.value)
  } else {
    error.value = result.error
  }
}
</script>

<style scoped>
.osz-importer {
  padding: 48px 32px;
  border: 3px dashed #ddd;
  border-radius: 16px;
  text-align: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  transition: all 0.3s;
}

.osz-importer:hover {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.osz-importer h2 {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.subtitle {
  color: #666;
  font-size: 14px;
  margin-bottom: 24px;
}

.file-input-wrapper {
  margin: 32px 0;
}

input[type="file"] {
  display: none;
}

.file-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.file-label:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
}

.file-label:active {
  transform: translateY(0);
}

.loading {
  margin-top: 24px;
  padding: 16px;
  color: #667eea;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading::before {
  content: '';
  width: 20px;
  height: 20px;
  border: 3px solid #667eea;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  margin-top: 24px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  color: #c62828;
  border-radius: 12px;
  border-left: 4px solid #c62828;
  font-weight: 500;
}

.success {
  margin-top: 24px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
  border-radius: 12px;
  border-left: 4px solid #2e7d32;
  font-weight: 600;
  font-size: 15px;
}

.features {
  margin-top: 32px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  text-align: left;
}

.feature-item {
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.feature-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.feature-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 13px;
  color: #666;
}
</style>
