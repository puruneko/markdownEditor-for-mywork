import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

// Monaco Worker setup (must be before any monaco import in components)
declare global {
  interface Window {
    MonacoEnvironment: {
      getWorker(_: unknown, label: string): Worker
    }
  }
}

window.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  },
}

import { registerTaskLanguage } from './lib/highlight/task-language'
import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

// Register custom md-task language and theme before any editor is created
registerTaskLanguage()

const app = mount(App, { target: document.getElementById('app')! })

export default app
