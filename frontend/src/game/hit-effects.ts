// 打击特效系统 - 参考 osu! 的打击反馈

import type { Judgement } from './types'
import { Judgement as J } from './types'

export interface HitEffect {
  x: number
  y: number
  startTime: number
  judgement: Judgement
  lane?: number
}

export interface ParticleEffect {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export class HitEffectRenderer {
  private effects: HitEffect[] = []
  private particles: ParticleEffect[] = []
  
  addHitEffect(x: number, y: number, judgement: Judgement, lane?: number): void {
    this.effects.push({
      x,
      y,
      startTime: performance.now(),
      judgement,
      lane
    })
    
    // 为 Perfect/Great 添加粒子效果
    if (judgement === J.Perfect || judgement === J.Great) {
      this.createParticles(x, y, judgement)
    }
  }
  
  private createParticles(x: number, y: number, judgement: Judgement): void {
    const count = judgement === J.Perfect ? 12 : 8
    const color = judgement === J.Perfect ? '#ffdd00' : '#88ff44'
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count
      const speed = 2 + Math.random() * 2
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 300 + Math.random() * 200,
        color,
        size: 3 + Math.random() * 2
      })
    }
  }
  
  render(ctx: CanvasRenderingContext2D, currentTime: number): void {
    // 渲染打击特效
    this.effects = this.effects.filter(effect => {
      const elapsed = currentTime - effect.startTime
      if (elapsed > 400) return false
      
      this.renderHitBurst(ctx, effect, elapsed)
      return true
    })
    
    // 渲染粒子
    this.particles = this.particles.filter(particle => {
      particle.life += 16
      if (particle.life > particle.maxLife) return false
      
      this.renderParticle(ctx, particle)
      return true
    })
  }
  
  private renderHitBurst(ctx: CanvasRenderingContext2D, effect: HitEffect, elapsed: number): void {
    const progress = elapsed / 400
    const alpha = 1 - progress
    const scale = 1 + progress * 0.5
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(effect.x, effect.y)
    ctx.scale(scale, scale)
    
    // 绘制扩散圆环
    const colors = {
      [J.Perfect]: '#ffdd00',
      [J.Great]: '#ffdd00',
      [J.Good]: '#88ff44',
      [J.Ok]: '#44ddff',
      [J.Bad]: '#aaaaaa',
      [J.Miss]: '#ff4444'
    }
    
    const color = colors[effect.judgement] || '#ffffff'
    
    // 外圈
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 25 + progress * 20, 0, Math.PI * 2)
    ctx.stroke()
    
    // 内圈
    ctx.globalAlpha = alpha * 0.5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 15 + progress * 15, 0, Math.PI * 2)
    ctx.stroke()
    
    // 发光效果
    ctx.globalAlpha = alpha * 0.3
    ctx.shadowColor = color
    ctx.shadowBlur = 20
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(0, 0, 10, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }
  
  private renderParticle(ctx: CanvasRenderingContext2D, particle: ParticleEffect): void {
    const progress = particle.life / particle.maxLife
    const alpha = 1 - progress
    
    // 更新位置
    particle.x += particle.vx
    particle.y += particle.vy
    particle.vy += 0.1 // 重力
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = particle.color
    ctx.shadowColor = particle.color
    ctx.shadowBlur = 10
    
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size * (1 - progress * 0.5), 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }
  
  clear(): void {
    this.effects = []
    this.particles = []
  }
}
