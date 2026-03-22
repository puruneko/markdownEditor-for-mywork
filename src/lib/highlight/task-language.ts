import * as monaco from 'monaco-editor'

// ----------------------------------------------------------------
// Stateless tokenizer state
// ----------------------------------------------------------------

class SimpleState implements monaco.languages.IState {
  equals(other: monaco.languages.IState): boolean {
    return other instanceof SimpleState
  }
  clone(): SimpleState {
    return new SimpleState()
  }
}

// ----------------------------------------------------------------
// Token provider
// ----------------------------------------------------------------

const tokenProvider: monaco.languages.TokensProvider = {
  getInitialState(): monaco.languages.IState {
    return new SimpleState()
  },

  tokenize(line: string, state: monaco.languages.IState) {
    const tokens: monaco.languages.IToken[] = []

    // @meta line: indented @key: value
    const metaMatch = line.match(/^(\s*)(@\w+)(:\s*)(.*)$/)
    if (metaMatch) {
      const [, indent, key, colon, value] = metaMatch
      let offset = 0
      if (indent.length > 0) {
        tokens.push({ startIndex: 0, scopes: '' })
        offset = indent.length
      }
      tokens.push({ startIndex: offset, scopes: 'meta.key.md-task' })
      offset += key.length
      tokens.push({ startIndex: offset, scopes: 'meta.sep.md-task' })
      offset += colon.length
      if (value.length > 0) {
        tokens.push({ startIndex: offset, scopes: 'meta.value.md-task' })
      }
      return { tokens, endState: state }
    }

    // Task checkbox line: (indent)- [?] text
    const taskMatch = line.match(/^(\s*-\s)(\[[xX>!\- ]\])(.*)$/)
    if (taskMatch) {
      const [, prefix, checkbox, rest] = taskMatch
      const marker = checkbox[1]
      const scope =
        marker === ' '                      ? 'task.todo.md-task'    :
        marker === 'x' || marker === 'X'   ? 'task.done.md-task'    :
        marker === '>'                      ? 'task.doing.md-task'   :
        marker === '!'                      ? 'task.blocked.md-task' :
                                              'task.hold.md-task'

      if (prefix.length > 0) tokens.push({ startIndex: 0, scopes: '' })
      tokens.push({ startIndex: prefix.length, scopes: scope })
      if (rest.length > 0) {
        tokens.push({ startIndex: prefix.length + checkbox.length, scopes: '' })
      }
      return { tokens, endState: state }
    }

    // Default: no special coloring
    tokens.push({ startIndex: 0, scopes: '' })
    return { tokens, endState: state }
  },
}

// ----------------------------------------------------------------
// Theme definition
// ----------------------------------------------------------------

function defineTaskTheme() {
  monaco.editor.defineTheme('md-task-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // @meta
      { token: 'meta.key.md-task',     foreground: 'dcdcaa' }, // yellow
      { token: 'meta.sep.md-task',     foreground: '606060' }, // dim gray
      { token: 'meta.value.md-task',   foreground: 'ce9178' }, // orange
      // Task statuses
      { token: 'task.todo.md-task',    foreground: 'cccccc' }, // default white
      { token: 'task.done.md-task',    foreground: '4ec9b0' }, // teal (done)
      { token: 'task.doing.md-task',   foreground: '569cd6' }, // blue (doing)
      { token: 'task.blocked.md-task', foreground: 'f44747' }, // red (blocked)
      { token: 'task.hold.md-task',    foreground: '808080' }, // gray (hold)
    ],
    colors: {},
  })
}

// ----------------------------------------------------------------
// Public registration
// ----------------------------------------------------------------

export function registerTaskLanguage() {
  monaco.languages.register({ id: 'md-task' })
  monaco.languages.setTokensProvider('md-task', tokenProvider)
  defineTaskTheme()
}
