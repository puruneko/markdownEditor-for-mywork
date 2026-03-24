import { Plugin } from 'obsidian'
import { AstView, AST_VIEW_TYPE } from './views/AstView'
import { FileSync } from './sync/file-sync'

export class MdAstEditorPlugin extends Plugin {
  private fileSync!: FileSync

  async onload(): Promise<void> {
    this.fileSync = new FileSync(this.app)

    this.registerView(
      AST_VIEW_TYPE,
      (leaf) => new AstView(leaf, this.fileSync),
    )

    this.addCommand({
      id: 'open-ast-view',
      name: 'AST View を開く',
      callback: () => void this.openAstView(),
    })

    this.addRibbonIcon('code-2', 'AST View を開く', () => {
      void this.openAstView()
    })

    this.fileSync.start()
  }

  async onunload(): Promise<void> {
    this.fileSync.stop()
    this.app.workspace.detachLeavesOfType(AST_VIEW_TYPE)
  }

  private async openAstView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(AST_VIEW_TYPE)
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0])
      return
    }

    const leaf = this.app.workspace.getRightLeaf(false)
    if (!leaf) return

    await leaf.setViewState({ type: AST_VIEW_TYPE, active: true })
    this.app.workspace.revealLeaf(leaf)
  }
}
