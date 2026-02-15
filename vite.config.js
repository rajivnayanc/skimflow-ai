import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json'
import { resolve } from 'path'
import { rmSync } from 'fs'

export default defineConfig({
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
            format: {
                comments: false,
            },
        },
        sourcemap: false,
    },
    plugins: [
        crx({ manifest }),
        {
            name: 'clean-vite-manifest',
            closeBundle() {
                try { rmSync(resolve('dist', '.vite'), { recursive: true, force: true }) } catch (e) { }
            }
        }
    ],
})