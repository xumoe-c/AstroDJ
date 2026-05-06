import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    server: {
        fs: {
            allow: [
                path.resolve(__dirname, 'public/maps'),
                path.resolve(__dirname, '..'),
                '.',
            ],
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
    },
})
