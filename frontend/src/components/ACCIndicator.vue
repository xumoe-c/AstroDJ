<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  offset: number  // in milliseconds (-50 to +50)
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true
})

// Clamp offset to -50ms to +50ms range
const clampedOffset = computed(() => {
  return Math.max(-50, Math.min(50, props.offset))
})

// Calculate pointer position (0% = left, 50% = center, 100% = right)
const pointerPosition = computed(() => {
  return ((clampedOffset.value + 50) / 100) * 100
})

// Get pointer color based on offset magnitude
const pointerColor = computed(() => {
  const absOffset = Math.abs(clampedOffset.value)
  if (absOffset < 10) return '#00ff88'  // green
  if (absOffset < 30) return '#ffdd00'  // yellow
  return '#ff4d6d'                       // red
})

// Format offset display
const offsetDisplay = computed(() => {
  if (clampedOffset.value === 0) return '0ms'
  const sign = clampedOffset.value > 0 ? '+' : ''
  return `${sign}${clampedOffset.value.toFixed(0)}ms`
})
</script>

<template>
  <div v-if="visible" class="acc-indicator">
    <div class="acc-dial">
      <div class="acc-scale">
        <span class="scale-label">-50ms</span>
        <span class="scale-label">-25ms</span>
        <span class="scale-label center">0ms</span>
        <span class="scale-label">+25ms</span>
        <span class="scale-label">+50ms</span>
      </div>
      <div class="acc-track">
        <div 
          class="acc-pointer" 
          :style="{ 
            left: `${pointerPosition}%`, 
            color: pointerColor,
            boxShadow: `0 0 10px ${pointerColor}`
          }"
        ></div>
      </div>
    </div>
    <div class="acc-value" :style="{ color: pointerColor }">
      {{ offsetDisplay }}
    </div>
  </div>
</template>

<style scoped>
.acc-indicator {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 280px;
  padding: 12px 16px;
  background: var(--astro-panel-bg);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  border: 1px solid rgba(107, 76, 230, 0.4);
  box-shadow: var(--glow-md) rgba(107, 76, 230, 0.3);
  z-index: 100;
}

.acc-dial {
  margin-bottom: 8px;
}

.acc-scale {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.scale-label {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--mono);
}

.scale-label.center {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.acc-track {
  position: relative;
  width: 100%;
  height: 30px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  overflow: visible;
}

.acc-pointer {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 36px;
  background: currentColor;
  border-radius: 2px;
  transition: left 0.2s ease, color 0.2s ease;
  pointer-events: none;
}

.acc-pointer::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid currentColor;
}

.acc-value {
  text-align: center;
  font-family: var(--mono);
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px currentColor;
}
</style>
