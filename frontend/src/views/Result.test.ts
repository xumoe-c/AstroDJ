import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import Result from './Result.vue'

describe('Result.vue', () => {
  let router: any

  beforeEach(() => {
    // Create a mock router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/result', component: Result }
      ]
    })

    // Clear sessionStorage before each test
    sessionStorage.clear()
  })

  it('displays result statistics correctly', async () => {
    // Navigate to result with query params
    await router.push({
      path: '/result',
      query: {
        score: '1000000',
        maxCombo: '150',
        accuracy: '98.50',
        perfect: '100',
        great: '40',
        good: '8',
        ok: '2',
        bad: '0',
        miss: '0'
      }
    })

    const wrapper = mount(Result, {
      global: {
        plugins: [router]
      }
    })

    // Wait for component to mount
    await wrapper.vm.$nextTick()

    // Check that statistics are displayed
    expect(wrapper.text()).toContain('1,000,000') // Score
    expect(wrapper.text()).toContain('98.50%') // Accuracy
    expect(wrapper.text()).toContain('150x') // Max combo
    expect(wrapper.text()).toContain('100') // Perfect count
    expect(wrapper.text()).toContain('40') // Great count
  })

  it('shows "返回选歌" button by default', async () => {
    await router.push('/result')

    const wrapper = mount(Result, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    const backButton = wrapper.find('.back-btn')
    expect(backButton.exists()).toBe(true)
    expect(backButton.text()).toBe('返回选歌')
  })

  it('navigates to home when clicking "返回选歌"', async () => {
    await router.push('/result')

    const wrapper = mount(Result, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Spy on router.push
    const pushSpy = vi.spyOn(router, 'push')

    // Click the back button
    const backButton = wrapper.find('.back-btn')
    await backButton.trigger('click')

    // Wait for the click handler to complete
    await wrapper.vm.$nextTick()

    // Check that router.push was called with '/'
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('calculates rank correctly', async () => {
    const testCases = [
      { accuracy: '100', expectedRank: 'SS' },
      { accuracy: '98', expectedRank: 'S' },
      { accuracy: '92', expectedRank: 'A' },
      { accuracy: '85', expectedRank: 'B' },
      { accuracy: '75', expectedRank: 'C' },
      { accuracy: '65', expectedRank: 'D' }
    ]

    for (const testCase of testCases) {
      await router.push({
        path: '/result',
        query: {
          score: '1000000',
          maxCombo: '100',
          accuracy: testCase.accuracy,
          perfect: '100',
          great: '0',
          good: '0',
          ok: '0',
          bad: '0',
          miss: '0'
        }
      })

      const wrapper = mount(Result, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const rankElement = wrapper.find('.rank')
      expect(rankElement.text()).toBe(testCase.expectedRank)
    }
  })

  it('displays judgment counts with correct colors', async () => {
    await router.push({
      path: '/result',
      query: {
        score: '1000000',
        maxCombo: '150',
        accuracy: '98.50',
        perfect: '100',
        great: '40',
        good: '8',
        ok: '2',
        bad: '1',
        miss: '1'
      }
    })

    const wrapper = mount(Result, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Check that all judgment rows are displayed
    const judgeRows = wrapper.findAll('.judge-row')
    expect(judgeRows.length).toBe(6) // PERFECT, GREAT, GOOD, OK, BAD, MISS

    // Check that judgment labels have correct colors
    const perfectLabel = judgeRows[0].find('.judge-label')
    expect(perfectLabel.attributes('style')).toContain('color: rgb(255, 221, 0)') // #ffdd00

    const missLabel = judgeRows[5].find('.judge-label')
    expect(missLabel.attributes('style')).toContain('color: rgb(255, 68, 68)') // #ff4444
  })

  it('calculates total notes correctly', async () => {
    await router.push({
      path: '/result',
      query: {
        score: '1000000',
        maxCombo: '150',
        accuracy: '98.50',
        perfect: '100',
        great: '40',
        good: '8',
        ok: '2',
        bad: '0',
        miss: '0'
      }
    })

    const wrapper = mount(Result, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Total notes should be 100 + 40 + 8 + 2 = 150
    expect(wrapper.text()).toContain('150')
  })
})
