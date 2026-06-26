import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        // Exact match only (not sub-paths like /dist/index.css)
        // Use library source so Svelte components are compiled by this project's
        // vite-plugin-svelte, avoiding runtime version mismatch with pre-built dist.
        find: /^svelte-calendar-lib$/,
        replacement: resolve(__dirname, 'node_modules/svelte-calendar-lib/src/index.ts'),
      },
      {
        // Same Svelte version mismatch workaround for gantt lib
        find: /^svelte-gantt-lib$/,
        replacement: resolve(__dirname, 'node_modules/svelte-gantt-lib/src/index.ts'),
      },
      {
        // Same Svelte version mismatch workaround for kanban lib
        find: /^svelte-kanban-lib$/,
        replacement: resolve(__dirname, 'node_modules/svelte-kanban-lib/src/index.ts'),
      },
    ],
  },
  optimizeDeps: {
    include: ['monaco-editor'],
    exclude: ['svelte-calendar-lib', 'svelte-gantt-lib', 'svelte-kanban-lib'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/obs-e2e/**', 'node_modules/**'],
    alias: [
      // Obsidian is a runtime-only package; replace with mock for tests.
      {
        find: /^obsidian$/,
        replacement: resolve(__dirname, 'tests/mocks/obsidian.ts'),
      },
    ],
  },
})
