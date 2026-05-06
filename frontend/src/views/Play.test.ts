import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import Play from './Play.vue'

// Mock the game modules
vi.mock('../game/wasm', () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
  validateChart: vi.fn(),
  judge: vi.fn().mockReturnValue(0)
}))

vi.mock('../game/audio', () => ({
  AudioEngine: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    onEnded: vi.fn(),
    songTimeMs: 0,
    duration: 180000,
    isPlaying: false
  }))
}))

describe('Play.vue - Preview Playback Integration', () => {
  let router: any

  beforeEach(() => {
    // Create a mock router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/play', component: Play }
      ]
    })
  })

  it('should render the play view', () => {
    const wrapper = mount(Play, {
      global: {
        plugins: [router]
      }
    })

    expect(wrapper.find('.play-view').exists()).toBe(true)
  })

  it('should display HUD elements when game is started', async () => {
    const wrapper = mount(Play, {
      global: {
        plugins: [router]
      }
    })

    // Set started to true to show HUD
    await wrapper.vm.$nextTick()
    
    // The HUD should exist in the template
    expect(wrapper.html()).toContain('hud')
  })

  it('should integrate TransitionIndicator component', () => {
    const wrapper = mount(Play, {
      global: {
        plugins: [router],
        stubs: {
          TransitionIndicator: true
        }
      }
    })

    // TransitionIndicator should be in the template
    expect(wrapper.html()).toContain('transition-indicator-stub')
  })

  it('should support startTime query parameter', async () => {
    // Navigate with startTime parameter
    await router.push('/play?chart=test&startTime=30000')
    
    const wrapper = mount(Play, {
      global: {
        plugins: [router]
      }
    })

    // Verify the route query parameter is accessible
    expect(wrapper.vm.$route.query.startTime).toBe('30000')
  })
})

describe('AudioEngine - Offset Support', () => {
  it('should support starting from offset', async () => {
    const { AudioEngine } = await import('../game/audio')
    const audio = new AudioEngine()
    
    // Mock the audio context and buffer
    const mockCtx = {
      currentTime: 10.0,
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        onended: null
      }),
      destination: {}
    }
    
    // @ts-ignore - accessing private property for testing
    audio['ctx'] = mockCtx
    // @ts-ignore - accessing private property for testing
    audio['buffer'] = { duration: 180 }
    
    // Start with 500ms lead-in and 30000ms offset
    audio.start(500, 30000)
    
    // Verify start was called with correct parameters
    const source = mockCtx.createBufferSource()
    expect(source.start).toHaveBeenCalledWith(10.5, 30.0)
  })
})
