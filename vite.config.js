import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json'

export default defineConfig({
    build: {
        minify: true, // or 'terser' or 'esbuild'
    },
    plugins: [crx({ manifest })],
})