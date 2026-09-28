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
  registerEditorExtension = vi.fn()
  registerEditorSuggest = vi.fn()
  registerMarkdownCodeBlockProcessor = vi.fn()
  loadData = vi.fn().mockResolvedValue(null)
  saveData = vi.fn().mockResolvedValue(undefined)
}

export class MarkdownRenderChild {
  containerEl: HTMLElement
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
  }
  onload(): void {}
  onunload(): void {}
  load(): void { this.onload() }
  unload(): void { this.onunload() }
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

export class PluginSettingTab {
  app: MockApp
  containerEl: HTMLElement
  constructor(app: MockApp, _plugin: unknown) {
    this.app = app
    this.containerEl = document.createElement('div')
  }
  display(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName = vi.fn().mockReturnThis()
  setDesc = vi.fn().mockReturnThis()
  addToggle = vi.fn().mockReturnThis()
  addText = vi.fn().mockReturnThis()
}

/**
 * issue-phase013-markdownEditor-002: `@` サジェスト用の最小限のEditorSuggestモック。
 * 実際の描画・ポップオーバー制御は行わず、サブクラスが継承・onTrigger/getSuggestions等を
 * 呼び出せることだけを保証する（ユニットテストでは純粋関数 `matchMetaKeyTrigger` を直接
 * テストするため、これ以上の挙動は不要）。
 */
export class EditorSuggest<T> {
  app: unknown
  context: unknown = null
  limit = 10
  // issue-phase014-markdownEditor-002: Tabキー決定用に`this.scope.register(...)`を
  // コンストラクタで呼ぶサブクラス（`MetaKeySuggest`）があるため、最小限のスタブを持たせる。
  scope = { register: vi.fn(), unregister: vi.fn() }
  constructor(app: unknown) {
    this.app = app
  }
  setInstructions = vi.fn()
  open = vi.fn()
  close = vi.fn()
}

export interface MockVault {
  read: ReturnType<typeof vi.fn>
  modify: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  getAbstractFileByPath: ReturnType<typeof vi.fn>
  getMarkdownFiles: ReturnType<typeof vi.fn>
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
      getMarkdownFiles: vi.fn(() => []),
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
