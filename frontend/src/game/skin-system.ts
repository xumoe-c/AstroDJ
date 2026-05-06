// 皮肤系统 - 参考 osu! 的皮肤架构

export interface SkinColors {
  // 音符颜色
  note: string
  noteGlow: string
  noteBorder: string
  
  // 长音符颜色
  holdBody: string
  holdHead: string
  holdTail: string
  
  // 判定线/圈颜色
  judgeLine: string
  judgeCircle: string
  
  // 背景颜色
  background: string
  lane: string
  laneDivider: string
  
  // 特效颜色
  hitBurst: string
  combo: string
}

export interface SkinConfig {
  name: string
  colors: SkinColors
  
  // 音符样式
  noteStyle: 'circle' | 'square' | 'diamond' | 'hexagon'
  noteSize: number
  noteBorderWidth: number
  
  // 特效设置
  hitBurstEnabled: boolean
  hitBurstDuration: number
  comboGlowEnabled: boolean
  
  // 判定反馈
  judgementScale: number
  judgementDuration: number
}

// 默认皮肤 - 星际主题
export const defaultSkin: SkinConfig = {
  name: 'AstroDJ Default',
  colors: {
    note: '#e8f0ff',
    noteGlow: 'rgba(107, 76, 230, 0.6)',
    noteBorder: '#6b4ce6',
    holdBody: 'rgba(107, 76, 230, 0.4)',
    holdHead: '#6b4ce6',
    holdTail: '#00d9ff',
    judgeLine: '#ffffff',
    judgeCircle: '#ffffff',
    background: '#1a1a2e',
    lane: 'rgba(30, 35, 60, 0.3)',
    laneDivider: '#333',
    hitBurst: '#00d9ff',
    combo: '#00ff88'
  },
  noteStyle: 'circle',
  noteSize: 1.0,
  noteBorderWidth: 2,
  hitBurstEnabled: true,
  hitBurstDuration: 300,
  comboGlowEnabled: true,
  judgementScale: 1.0,
  judgementDuration: 400
}

// 预设皮肤
export const skins: Record<string, SkinConfig> = {
  default: defaultSkin,
  
  // 霓虹皮肤
  neon: {
    name: 'Neon Pulse',
    colors: {
      note: '#ff00ff',
      noteGlow: 'rgba(255, 0, 255, 0.8)',
      noteBorder: '#ff00ff',
      holdBody: 'rgba(255, 0, 255, 0.3)',
      holdHead: '#ff00ff',
      holdTail: '#00ffff',
      judgeLine: '#00ffff',
      judgeCircle: '#ff00ff',
      background: '#0a0a1a',
      lane: 'rgba(255, 0, 255, 0.1)',
      laneDivider: '#ff00ff',
      hitBurst: '#00ffff',
      combo: '#ff00ff'
    },
    noteStyle: 'diamond',
    noteSize: 1.1,
    noteBorderWidth: 3,
    hitBurstEnabled: true,
    hitBurstDuration: 250,
    comboGlowEnabled: true,
    judgementScale: 1.2,
    judgementDuration: 350
  },
  
  // 简约皮肤
  minimal: {
    name: 'Minimal',
    colors: {
      note: '#ffffff',
      noteGlow: 'rgba(255, 255, 255, 0.3)',
      noteBorder: '#888888',
      holdBody: 'rgba(255, 255, 255, 0.2)',
      holdHead: '#ffffff',
      holdTail: '#cccccc',
      judgeLine: '#ffffff',
      judgeCircle: '#ffffff',
      background: '#1a1a1a',
      lane: 'rgba(255, 255, 255, 0.05)',
      laneDivider: '#333333',
      hitBurst: '#ffffff',
      combo: '#ffffff'
    },
    noteStyle: 'square',
    noteSize: 0.9,
    noteBorderWidth: 1,
    hitBurstEnabled: false,
    hitBurstDuration: 200,
    comboGlowEnabled: false,
    judgementScale: 0.9,
    judgementDuration: 300
  }
}

// 皮肤管理器
export class SkinManager {
  private currentSkin: SkinConfig = defaultSkin
  
  setSkin(skinName: string): void {
    if (skins[skinName]) {
      this.currentSkin = skins[skinName]
    }
  }
  
  getSkin(): SkinConfig {
    return this.currentSkin
  }
  
  getColor(key: keyof SkinColors): string {
    return this.currentSkin.colors[key]
  }
  
  getNoteStyle(): string {
    return this.currentSkin.noteStyle
  }
  
  getNoteSize(): number {
    return this.currentSkin.noteSize
  }
}

export const skinManager = new SkinManager()
