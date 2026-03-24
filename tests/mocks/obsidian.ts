/**
 * Obsidian API mock for Vitest (Layer 1 + Layer 2 tests).
 * Use: vi.mock('obsidian', () => import('../tests/mocks/obsidian'))
 */
import { vi } from 'vitest'

export class Plugin {
  app: MockApp
  constructor(app: MockApp) {
    this.app = app
  }
  async onload(): Promise<void> {}
  async onunload(): Promise<void> {}
  addCommand = vi.fn()
  registerView = vi.fn()
  addRibbonIcon = vi.fn()
  addStatusBarItem = vi.fn()
  addSettingTab = vi.fn()
}

export class ItemView {
  containerEl: HTMLElement
  app: MockApp
  constructor(leaf: WorkspaceLeaf) {
    this.containerEl = document.createElement('div')
    this.app = leaf.app
  }
  getViewType(): string { return '' }
  getDisplayText(): string { return '' }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export class WorkspaceLeaf {
  app: MockApp
  constructor(app: MockApp) {
    this.app = app
  }
  setViewState = vi.fn()
}

export class TFile {
  path: string
  basename: string
  extension: string
  stat: { mtime: number; ctime: number; size: number }
  constructor(path: string) {
    this.path = path
    this.basename = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
    this.extension = path.split('.').pop() ?? ''
    this.stat = { mtime: Date.now(), ctime: Date.now(), size: 0 }
  }
}

export class MarkdownView extends ItemView {
  getViewType() { return 'markdown' }
  getDisplayText() { return '' }
}

export class Notice {
  constructor(_message: string) {}
}

export interface MockVault {
  read: ReturnType<typeof vi.fn>
  modify: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  getAbstractFileByPath: ReturnType<typeof vi.fn>
}

export interface MockWorkspace {
  getActiveViewOfType: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  getLeavesOfType: ReturnType<typeof vi.fn>
  revealLeaf: ReturnType<typeof vi.fn>
  detachLeavesOfType: ReturnType<typeof vi.fn>
  getRightLeaf: ReturnType<typeof vi.fn>
  getLeaf: ReturnType<typeof vi.fn>
  activeLeaf: WorkspaceLeaf | null
}

export interface MockApp {
  vault: MockVault
  workspace: MockWorkspace
}

export function createMockApp(): MockApp {
  return {
    vault: {
      read: vi.fn(),
      modify: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getAbstractFileByPath: vi.fn(),
    },
    workspace: {
      getActiveViewOfType: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getLeavesOfType: vi.fn(() => []),
      revealLeaf: vi.fn(),
      detachLeavesOfType: vi.fn(),
      getRightLeaf: vi.fn(),
      getLeaf: vi.fn(),
      activeLeaf: null,
    },
  }
}
