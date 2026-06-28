<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as monaco from 'monaco-editor'

  interface Props {
    value?: string
    language?: string
    theme?: string
    readonly?: boolean
    onchange?: (value: string) => void
    /** エディタ生成後に呼ばれるコールバック。引数の関数で指定行（0-based）にスクロール＆カーソル移動できる。 */
    registerReveal?: (fn: (line: number) => void) => void
  }

  let {
    value = $bindable(''),
    language = 'plaintext',
    theme = 'md-task-dark',
    readonly = false,
    onchange,
    registerReveal,
  }: Props = $props()

  let container: HTMLDivElement
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let suppressUpdate = false

  onMount(() => {
    editor = monaco.editor.create(container, {
      value,
      language,
      readOnly: readonly,
      theme,
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      renderWhitespace: 'none',
      folding: false,
      padding: { top: 8, bottom: 8 },
    })

    editor.onDidChangeModelContent(() => {
      if (suppressUpdate) return
      const current = editor!.getValue()
      value = current
      onchange?.(current)
    })

    // Monaco は 1-based 行番号。引数は 0-based で受け取り +1 して渡す。
    registerReveal?.((line) => {
      const monacoLine = line + 1
      editor!.revealLineInCenter(monacoLine)
      editor!.setPosition({ lineNumber: monacoLine, column: 1 })
      editor!.focus()
    })
  })

  onDestroy(() => {
    editor?.dispose()
  })

  // Sync external value changes → editor (without triggering onchange loop)
  $effect(() => {
    if (!editor) return
    if (editor.getValue() === value) return
    suppressUpdate = true
    editor.setValue(value)
    suppressUpdate = false
  })

  // Sync readonly changes
  $effect(() => {
    editor?.updateOptions({ readOnly: readonly })
  })

  // Sync language changes (e.g. task-highlight toggle)
  $effect(() => {
    const model = editor?.getModel()
    if (model && monaco.editor.getModel(model.uri)) {
      monaco.editor.setModelLanguage(model, language)
    }
  })
</script>

<div bind:this={container} class="monaco-container"></div>

<style>
  .monaco-container {
    width: 100%;
    height: 100%;
  }
</style>
