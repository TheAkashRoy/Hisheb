import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiRoot = path.join(__dirname, 'api')

// Walk api/ into Vercel-style routes:
//   api/state.js        -> ['state']
//   api/auth/login.js   -> ['auth', 'login']
//   api/groups/[id].js  -> ['groups', '[id]']   (dynamic segment)
// Files/folders starting with "_" are helpers, not routes (matches Vercel).
function walk(dir, base = []) {
  let out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out = out.concat(walk(full, [...base, entry.name]))
    else if (entry.name.endsWith('.js')) out.push({ file: full, segments: [...base, entry.name.slice(0, -3)] })
  }
  return out
}

// Mounts the Vercel-style /api/**.js serverless functions inside the Vite
// dev server, so `npm run dev` alone is enough locally (no `vercel dev`
// needed). On Vercel itself, each file under /api becomes its own function
// using the same file-based routing convention - this is dev-only glue.
function apiDevPlugin() {
  return {
    name: 'hisheb-api-dev',
    async configureServer(server) {
      const routes = []
      for (const { file, segments } of walk(apiRoot)) {
        const mod = await import(pathToFileURL(file).href)
        routes.push({ segments, handler: mod.default })
      }
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url.split('?')[0]
        if (!urlPath.startsWith('/api/')) return next()
        const reqSegments = urlPath.slice(1).split('/').filter(Boolean).slice(1) // drop leading "api"

        for (const r of routes) {
          if (r.segments.length !== reqSegments.length) continue
          const params = {}
          let ok = true
          for (let i = 0; i < r.segments.length; i++) {
            const seg = r.segments[i]
            if (seg.startsWith('[') && seg.endsWith(']')) params[seg.slice(1, -1)] = reqSegments[i]
            else if (seg !== reqSegments[i]) {
              ok = false
              break
            }
          }
          if (!ok) continue

          const query = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''))
          req.query = { ...query, ...params } // matches how Vercel merges route params into req.query
          r.handler(req, res).catch((err) => {
            console.error('[hisheb] api error', urlPath, err)
            if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Server error' }))
          })
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    apiDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon.ico'],
      manifest: {
        name: 'Hisheb - Split expenses fairly',
        short_name: 'Hisheb',
        description: 'Split shared expenses with friends and groups. Works offline.',
        theme_color: '#12b886',
        background_color: '#0b1416',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
