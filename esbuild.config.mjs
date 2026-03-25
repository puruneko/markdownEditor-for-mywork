import esbuild from 'esbuild'
import process from 'process'
import builtins from 'builtin-modules'
import esbuildSvelte from 'esbuild-svelte'
import { sveltePreprocess } from 'svelte-preprocess'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prod = process.argv[2] === 'production'

import { createRequire } from 'module'
import { readFile } from 'fs/promises'
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
    const libs = {
      'svelte-calendar-lib': resolve(__dirname, 'node_modules/svelte-calendar-lib/src/index.ts'),
      'svelte-gantt-lib': resolve(__dirname, 'node_modules/svelte-gantt-lib/src/index.ts'),
    }

    // Exact lib package names → source entry
    build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib)$/ }, (args) => {
      return { path: libs[args.path] }
    })

    // Lib subpath CSS imports → return empty module (css injected by esbuild-svelte; require() can't load css)
    build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib)\/.*\.css$/ }, () => {
      return { path: 'empty', namespace: 'empty-css' }
    })
    build.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => {
      return { contents: '', loader: 'js' }
    })

    // Always resolve svelte/* from this project's node_modules (fixes workspace Svelte 4 clash)
    build.onResolve({ filter: /^svelte(\/|$)/ }, (args) => {
      try {
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
      preprocess: sveltePreprocess(),
      compilerOptions: {
        css: 'injected',
        // Do NOT set runes: true globally — legacy components (e.g. GanttChart.svelte)
        // use 'export let' syntax. Svelte 5 auto-detects runes per file.
      },
    }),
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
