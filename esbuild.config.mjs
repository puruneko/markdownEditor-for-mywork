import esbuild from 'esbuild'
import process from 'process'
import builtins from 'builtin-modules'
import esbuildSvelte from 'esbuild-svelte'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFile } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prod = process.argv[2] === 'production'

const OBSIDIAN_PLUGIN_DIR =
  '/mnt/c/Users/progp/workspace/obsidian/obsidian_trial/.obsidian/plugins/md-ast-editor'

const obsidianCopyPlugin = {
  name: 'obsidian-copy',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return
      try {
        await Promise.all([
          copyFile('main.js', `${OBSIDIAN_PLUGIN_DIR}/main.js`),
          copyFile('manifest.json', `${OBSIDIAN_PLUGIN_DIR}/manifest.json`),
        ])
        console.log('[obsidian-copy] コピー完了')
      } catch (e) {
        console.error('[obsidian-copy] コピー失敗:', e.message)
      }
    })
  },
}

import { createRequire } from 'module'
import { readFile } from 'fs/promises'
import { realpathSync } from 'fs'
const require = createRequire(import.meta.url)

/**
 * Pre-process `.svelte.ts` files by stripping TypeScript types before calling
 * svelte.compileModule. Without this, Svelte's parser chokes on complex TypeScript
 * generics (e.g. mapped types with conditional types) in `.svelte.ts` module files.
 *
 * esbuild-svelte itself skips the preprocessor for `.svelte.ts` files and relies on
 * Svelte's native TS support, which doesn't handle all TypeScript syntax. This plugin
 * intercepts those files first, strips types, then calls compileModule directly.
 */
const { compileModule } = await import('svelte/compiler')

const svelteModuleTypeStripPlugin = {
  name: 'svelte-module-type-strip',
  setup(build) {
    // Intercept .svelte.ts files before esbuild-svelte, compile them ourselves.
    build.onLoad({ filter: /\.svelte\.ts$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8')
      // Strip TypeScript types (esbuild handles complex generics; Svelte 5 native TS does not)
      const { code: jsCode } = await esbuild.transform(source, {
        loader: 'ts',
        target: 'esnext',
        tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
      })
      const result = compileModule(jsCode, {
        filename: args.path,
        generate: 'client',
      })
      return {
        contents: result.js.code,
        loader: 'js',
        resolveDir: dirname(args.path),
      }
    })
  },
}

/** Resolve all svelte/* imports to this project's Svelte 5, and handle lib sources. */
const svelteLibSourcePlugin = {
  name: 'svelte-lib-source',
  setup(build) {
    // Use realpathSync to resolve symlinks to their real paths.
    // node_modules/svelte-calendar-lib and svelte-gantt-lib are symlinks to workspace siblings.
    // Without resolving to real paths, esbuild loads the same .svelte files via both the
    // symlink path and the real path, treating them as separate modules. This causes component
    // functions (e.g. WeekView) to be renamed (WeekView → WeekView2) in one copy while the
    // other copy's call sites still reference the original name, resulting in ReferenceError.
    const libs = {
      'svelte-calendar-lib': resolve(realpathSync(resolve(__dirname, 'node_modules/svelte-calendar-lib')), 'src/index.ts'),
      'svelte-gantt-lib': resolve(realpathSync(resolve(__dirname, 'node_modules/svelte-gantt-lib')), 'src/index.ts'),
      'svelte-kanban-lib': resolve(realpathSync(resolve(__dirname, 'node_modules/svelte-kanban-lib')), 'src/index.ts'),
    }

    // Exact lib package names → source entry
    build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib|svelte-kanban-lib)$/ }, (args) => {
      return { path: libs[args.path] }
    })

    // Lib subpath CSS imports → return empty module (css injected by esbuild-svelte; require() can't load css)
    build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib|svelte-kanban-lib)\/.*\.css$/ }, () => {
      return { path: 'empty', namespace: 'empty-css' }
    })
    build.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => {
      return { contents: '', loader: 'js' }
    })

    // Always resolve luxon from this project's node_modules.
    // workspace siblings (calendar-for-mywork, ganttchart-for-mywork) each have their own
    // node_modules/luxon. If those copies are used, DateTime instanceof checks fail because
    // the DateTime class from the main project and the lib are different objects.
    build.onResolve({ filter: /^luxon$/ }, () => {
      return { path: require.resolve('luxon', { paths: [__dirname] }) }
    })

    // Always resolve svelte/* from this project's node_modules (fixes workspace Svelte 4 clash)
    build.onResolve({ filter: /^svelte(\/|$)/ }, (args) => {
      try {
        if (args.path === 'svelte') {
          // require.resolve uses Node CJS "default" condition which resolves to
          // index-server.js in Svelte 5, causing "mount() is not available on the server".
          // Explicitly use the browser (client) entry instead.
          return { path: resolve(__dirname, 'node_modules/svelte/src/index-client.js') }
        }
        const resolved = require.resolve(args.path, { paths: [__dirname] })
        return { path: resolved }
      } catch {
        return null
      }
    })
  },
}

const context = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  plugins: [
    svelteModuleTypeStripPlugin,
    svelteLibSourcePlugin,
    esbuildSvelte({
      compilerOptions: {
        css: 'injected',
        generate: 'client',
        // Do NOT set runes: true globally — legacy components (e.g. GanttChart.svelte)
        // use 'export let' syntax. Svelte 5 auto-detects runes per file.
      },
    }),
    ...(prod ? [] : [obsidianCopyPlugin]),
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
})

if (prod) {
  await context.rebuild()
  process.exit(0)
} else {
  await context.watch()
}
