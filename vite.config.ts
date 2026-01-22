import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs'

// Custom plugin to handle Chrome Extension build
const chromeExtensionPlugin = () => ({
  name: 'chrome-extension',
  writeBundle() {
    // Copy manifest.json to dist
    copyFileSync('manifest.json', 'dist/manifest.json')

    // Create icons directory and placeholder icons
    if (!existsSync('dist/icons')) {
      mkdirSync('dist/icons', { recursive: true })
    }

    // Create SVG icon
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#6366f1"/><circle cx="64" cy="64" r="16" fill="none" stroke="white" stroke-width="6"/><path d="M48 48 L28 28 M80 48 L100 28 M48 80 L28 100 M80 80 L100 100" stroke="white" stroke-width="6" stroke-linecap="round"/></svg>`
    writeFileSync('dist/icons/icon.svg', iconSvg)
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), chromeExtensionPlugin()],
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.tsx'),
        injected: resolve(__dirname, 'src/injected/interceptor.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
        // Prevent code splitting for content scripts
        manualChunks: undefined,
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    // Don't minify for easier debugging
    minify: false,
    sourcemap: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
