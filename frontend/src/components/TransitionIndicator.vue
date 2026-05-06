<script setup lang="ts">
import { computed } from 'vue'
import type { TransitionInfo } from '../game/runtime-manager'

const props = defineProps<{
  transitionInfo: TransitionInfo | null
}>()

// Mode-specific color schemes
const MODE_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  'mania': { 
    primary: '#4a9eff', 
    secondary: '#2d7dd2',
    glow: 'rgba(74, 158, 255, 0.6)'
  },
  'taiko': { 
    primary: '#ff4a4a', 
    secondary: '#d22d2d',
    glow: 'rgba(255, 74, 74, 0.6)'
  },
  'osu-standard': { 
    primary: '#ff69b4', 
    secondary: '#d24d8f',
    glow: 'rgba(255, 105, 180, 0.6)'
  }
}

// Visibility: show when transition is within 3000ms
const isVisible = computed(() => {
  return props.transitionInfo !== null && 
         props.transitionInfo.timeUntilTransition < 3000
})

// Show countdown when transition is within 1500ms
const showCountdown = computed(() => {
  return props.transitionInfo !== null && 
         props.transitionInfo.timeUntilTransition < 1500
})

// Format countdown as seconds with one decimal place
const countdownText = computed(() => {
  if (!props.transitionInfo) return ''
  const seconds = props.transitionInfo.timeUntilTransition / 1000
  return seconds.toFixed(1)
})

// Get mode-specific colors
const modeColors = computed(() => {
  if (!props.transitionInfo) return MODE_COLORS['mania']
  return MODE_COLORS[props.transitionInfo.nextMode] || MODE_COLORS['mania']
})

// Format mode name for display
const modeName = computed(() => {
  if (!props.transitionInfo) return ''
  return props.transitionInfo.nextMode.toUpperCase()
})

// Format key bindings for display
const keyBindingsText = computed(() => {
  if (!props.transitionInfo || !props.transitionInfo.keyBindings.length) {
    return ''
  }
  return props.transitionInfo.keyBindings.join(' ')
})

// Progress bar percentage (0-100)
const progressPercent = computed(() => {
  if (!props.transitionInfo) return 0
  const percent = (1 - props.transitionInfo.timeUntilTransition / 3000) * 100
  return Math.max(0, Math.min(100, percent))
})

// Urgency level for visual feedback
const urgencyLevel = computed(() => {
  if (!props.transitionInfo) return 'normal'
  const time = props.transitionInfo.timeUntilTransition
  if (time < 500) return 'critical'
  if (time < 1000) return 'urgent'
  return 'normal'
})
</script>

<template>
  <div v-if="isVisible" class="transition-indicator" :class="urgencyLevel">
    <div class="indicator-glow" :style="{ 
      boxShadow: `0 0 60px ${modeColors.glow}, 0 0 100px ${modeColors.glow}` 
    }"></div>
    
    <div class="indicator-content">
      <!-- Mode badge -->
      <div class="mode-badge" :style="{ 
        background: `linear-gradient(135deg, ${modeColors.primary}, ${modeColors.secondary})`,
        boxShadow: `0 0 20px ${modeColors.glow}`
      }">
        <span class="mode-icon">▶</span>
        <span class="mode-text">{{ modeName }}</span>
      </div>

      <!-- Countdown display -->
      <div v-if="showCountdown" class="countdown-container">
        <div class="countdown-circle" :style="{ 
          borderColor: modeColors.primary,
          boxShadow: `0 0 20px ${modeColors.glow}, inset 0 0 20px ${modeColors.glow}`
        }">
          <span class="countdown-number">{{ countdownText }}</span>
          <span class="countdown-unit">s</span>
        </div>
      </div>

      <!-- Key bindings -->
      <div v-if="keyBindingsText" class="key-bindings">
        <span class="keys-label">KEYS</span>
        <span class="keys-text">{{ keyBindingsText }}</span>
      </div>
      
      <!-- Progress bar -->
      <div class="progress-container">
        <div class="progress-track">
          <div class="progress-fill" :style="{ 
            width: progressPercent + '%',
            background: `linear-gradient(90deg, ${modeColors.secondary}, ${modeColors.primary})`,
            boxShadow: `0 0 10px ${modeColors.glow}`
          }"></div>
        </div>
        <div class="progress-label">INCOMING</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transition-indicator {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 15;
  pointer-events: none;
  transition: transform 0.2s ease-out;
}

.transition-indicator.urgent {
  transform: translateX(-50%) scale(1.05);
}

.transition-indicator.critical {
  transform: translateX(-50%) scale(1.1);
  animation: shake 0.3s ease-in-out infinite;
}

.indicator-glow {
  position: absolute;
  inset: -20px;
  border-radius: 24px;
  opacity: 0.3;
  z-index: -1;
  animation: pulse-glow 2s ease-in-out infinite;
}

.indicator-content {
  background: rgba(10, 14, 26, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 20px 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 280px;
}

/* Mode badge */
.mode-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px;
  border-radius: 30px;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.mode-icon {
  font-size: 0.9rem;
  animation: pulse 1s ease-in-out infinite;
}

.mode-text {
  font-family: 'Segoe UI', sans-serif;
}

/* Countdown circle */
.countdown-container {
  margin: 8px 0;
}

.countdown-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  position: relative;
}

.countdown-number {
  font-size: 2.5rem;
  font-weight: 900;
  color: #fff;
  font-family: 'Consolas', monospace;
  line-height: 1;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
}

.countdown-unit {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  margin-top: 2px;
}

.critical .countdown-circle {
  animation: pulse-critical 0.3s ease-in-out infinite;
}

.critical .countdown-number {
  color: #ffff00;
  text-shadow: 0 0 30px rgba(255, 255, 0, 1);
  animation: flash 0.2s ease-in-out infinite;
}

/* Key bindings */
.key-bindings {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.keys-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  letter-spacing: 1px;
}

.keys-text {
  font-size: 1rem;
  color: #fff;
  font-family: 'Consolas', monospace;
  font-weight: 600;
  letter-spacing: 3px;
}

/* Progress bar */
.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.1s linear;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 30px;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4));
  animation: shimmer 1s ease-in-out infinite;
}

.progress-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  letter-spacing: 2px;
  text-align: center;
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

@keyframes pulse-critical {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(-50%) translateX(0);
  }
  25% {
    transform: translateX(-50%) translateX(-4px);
  }
  75% {
    transform: translateX(-50%) translateX(4px);
  }
}

@keyframes flash {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Responsive */
@media (max-width: 768px) and (orientation: landscape) {
  .transition-indicator {
    top: 60px;
  }

  .indicator-content {
    padding: 16px 24px;
    gap: 12px;
    min-width: 240px;
  }

  .mode-badge {
    padding: 8px 20px;
    font-size: 1rem;
    gap: 8px;
  }

  .countdown-circle {
    width: 80px;
    height: 80px;
  }

  .countdown-number {
    font-size: 2rem;
  }

  .key-bindings {
    padding: 6px 16px;
    gap: 10px;
  }

  .keys-text {
    font-size: 0.9rem;
  }

  .progress-track {
    height: 6px;
  }
}
</style>
