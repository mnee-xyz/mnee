import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@bsv/sdk', 'bip39'],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'mnee',
    dts: false,
    outExtension: () => ({ js: '.umd.js' }),
    sourcemap: true,
    esbuildPlugins: [NodeGlobalsPolyfillPlugin({ buffer: true, process: true })],
  },
])
