import { describe, it, expect, vi } from 'vitest'
import { EditorEventBus } from '../../src/sync/editor-event-bus'

describe('EditorEventBus', () => {
  it('requestFocusLine calls registered handler', () => {
    const bus = new EditorEventBus()
    const handler = vi.fn()
    bus.onFocusLine(handler)

    bus.requestFocusLine(5)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(5)
  })

  it('calls multiple handlers', () => {
    const bus = new EditorEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.onFocusLine(h1)
    bus.onFocusLine(h2)

    bus.requestFocusLine(10)

    expect(h1).toHaveBeenCalledWith(10)
    expect(h2).toHaveBeenCalledWith(10)
  })

  it('returned unsubscribe function removes handler', () => {
    const bus = new EditorEventBus()
    const handler = vi.fn()
    const unsubscribe = bus.onFocusLine(handler)

    unsubscribe()
    bus.requestFocusLine(3)

    expect(handler).not.toHaveBeenCalled()
  })

  it('does nothing when no handlers are registered', () => {
    const bus = new EditorEventBus()
    expect(() => bus.requestFocusLine(0)).not.toThrow()
  })

  it('passes lineNumber 0 correctly', () => {
    const bus = new EditorEventBus()
    const handler = vi.fn()
    bus.onFocusLine(handler)

    bus.requestFocusLine(0)

    expect(handler).toHaveBeenCalledWith(0)
  })
})
