import esbuild from 'esbuild'
import process from 'process'
import builtins from 'builtin-modules'
import esbuildSvelte from 'esbuild-svelte'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFile, readFile, writeFile } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prod = process.argv[2] === 'production'

/**
 * issue-phase003-008（2026-09-17増分）: メタタグCSSの外だし対応。
 * issue-phase003-013（2026-09-17）: 見出し強調CSSを結合対象に追加。
 * styles/*.css を結合し、Obsidian が自動ロードするリポジトリ直下 styles.css へ書き出す。
 * 各ファイルはユーザーが直接編集する「正の情報源」。styles.css はビルド生成物
 * （main.js と同様の既存運用）として扱う。
 */
const STYLE_SOURCES = [
  'styles/base.css',
  'styles/heading-emphasis.css',
  'styles/metatag-raw.css',
  'styles/metatag-wysiwyg.css',
]

const stylesBundlePlugin = {
  name: 'styles-bundle',
  setup(build) {
    const bundleStyles = async () => {
      const parts = await Promise.all(
        STYLE_SOURCES.map((p) => readFile(resolve(__dirname, p), 'utf8')),
      )
      const banner =
        `/* このファイルは自動生成です。編集は ${STYLE_SOURCES.join('・')} を\n` +
        ' * 対象に行ってください（esbuild.config.mjs の stylesBundlePlugin が\n' +
        ' * ビルド時に結合してこのファイルへ書き出します）。 */\n\n'
      await writeFile(resolve(__dirname, 'styles.css'), banner + parts.join('\n\n'))
    }
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return
      try {
        await bundleStyles()
        console.log('[styles-bundle] styles.css を再生成しました')
      } catch (e) {
        console.error('[styles-bundle] 失敗:', e.message)
      }
    })
  },
}

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
          // issue-phase003-008（2026-09-17再増分）: styles.css がコピー対象から漏れており、
          // メタタグCSSの変更が実機Obsidianへ反映されない不具合があったため追加。
          copyFile('styles.css', `${OBSIDIAN_PLUGIN_DIR}/styles.css`),
        ])
        console.log('[obsidian-copy] コピー完了')
      } catch (e) {
        console.error('[obsidian-copy] コピー失敗:', e.message)
      }
    })
  },
}

import { createRequire } from 'module'
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
      'svelte-dashboard-lib': resolve(realpathSync(resolve(__dirname, 'node_modules/svelte-dashboard-lib')), 'src/index.ts'),
    }

    // Exact lib package names → source entry
    build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib|svelte-kanban-lib|svelte-dashboard-lib)$/ }, (args) => {
      return { path: libs[args.path] }
    })

    // Lib subpath CSS imports → return empty module (css injected by esbuild-svelte; require() can't load css)
    build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib|svelte-kanban-lib|svelte-dashboard-lib)\/.*\.css$/ }, () => {
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
    stylesBundlePlugin,
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
