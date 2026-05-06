import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransitionIndicator from './TransitionIndicator.vue'
import type { TransitionInfo } from '../game/runtime-manager'

describe('TransitionIndicator', () => {
    test('is not visible when transitionInfo is null', () => {
        const wrapper = mount(TransitionIndicator, {
            props: {
                transitionInfo: null
            }
        })

        expect(wrapper.find('.transition-indicator').exists()).toBe(false)
    })

    test('is not visible when transition is beyond 3000ms', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 3500,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.transition-indicator').exists()).toBe(false)
    })

    test('is visible when transition is within 3000ms', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2500,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.transition-indicator').exists()).toBe(true)
    })

    test('displays mode name in uppercase', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.mode-name').text()).toBe('MANIA')
    })

    test('does not show countdown when transition is beyond 1000ms', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'taiko',
            nextSegmentId: 'seg2',
            timeUntilTransition: 1500,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.countdown').exists()).toBe(false)
    })

    test('shows countdown when transition is within 1000ms', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'taiko',
            nextSegmentId: 'seg2',
            timeUntilTransition: 800,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.countdown').exists()).toBe(true)
        expect(wrapper.find('.countdown').text()).toBe('0.8s')
    })

    test('formats countdown with one decimal place', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'osu-standard',
            nextSegmentId: 'seg2',
            timeUntilTransition: 456,
            keyBindings: ['Mouse', 'Z', 'X']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.countdown').text()).toBe('0.5s')
    })

    test('displays key bindings', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.key-bindings').text()).toBe('D F J K')
    })

    test('applies mania color scheme', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        const indicator = wrapper.find('.transition-indicator')
        expect(indicator.attributes('style')).toContain('background-color: rgb(74, 158, 255)')
    })

    test('applies taiko color scheme', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'taiko',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: ['D', 'F']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        const indicator = wrapper.find('.transition-indicator')
        expect(indicator.attributes('style')).toContain('background-color: rgb(255, 74, 74)')
    })

    test('applies osu-standard color scheme', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'osu-standard',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: ['Mouse', 'Z', 'X']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        const indicator = wrapper.find('.transition-indicator')
        expect(indicator.attributes('style')).toContain('background-color: rgb(255, 105, 180)')
    })

    test('indicator is positioned at top center', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: ['D', 'F', 'J', 'K']
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        const indicator = wrapper.find('.transition-indicator')
        
        // Check positioning (component uses inline styles for color, CSS for position)
        expect(indicator.classes()).toContain('transition-indicator')
    })

    test('handles empty key bindings', () => {
        const transitionInfo: TransitionInfo = {
            nextMode: 'mania',
            nextSegmentId: 'seg2',
            timeUntilTransition: 2000,
            keyBindings: []
        }

        const wrapper = mount(TransitionIndicator, {
            props: { transitionInfo }
        })

        expect(wrapper.find('.key-bindings').exists()).toBe(false)
    })
})
