import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiRoot = path.join(__dirname, 'api')

// Walk api/ into Vercel-style routes:
//   api/state.js              -> ['state']
//   api/auth/[action].js      -> ['auth', '[action]']         (single dynamic segment)
//   api/people/[[...id]].js   -> ['people', '[[...id]]']      (optional catch-all - matches
//                                                               /api/people AND /api/people/xyz)
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

// Matches one route's segments against the request's segments. Returns a
// params object (possibly empty) on match, or null. Handles plain segments,
// single dynamic segments ([name]), and a trailing optional catch-all
// ([[...name]], which must be the route's last segment and absorbs zero or
// more remaining request segments into an array - mirrors Vercel's routing).
function matchRoute(routeSegments, reqSegments) {
  const last = routeSegments[routeSegments.length - 1] || ''
  const catchAll = last.match(/^\[\[\.\.\.(.+)\]\]$/)

  if (catchAll) {
    const prefix = routeSegments.slice(0, -1)
    if (reqSegments.length < prefix.length) return null
    const params = {}
    for (let i = 0; i < prefix.length; i++) {
      const seg = prefix[i]
      if (seg.startsWith('[') && seg.endsWith(']')) params[seg.slice(1, -1)] = reqSegments[i]
      else if (seg !== reqSegments[i]) return null
    }
    params[catchAll[1]] = reqSegments.slice(prefix.length)
    return params
  }

  if (routeSegments.length !== reqSegments.length) return null
  const params = {}
  for (let i = 0; i < routeSegments.length; i++) {
    const seg = routeSegments[i]
    if (seg.startsWith('[') && seg.endsWith(']')) params[seg.slice(1, -1)] = reqSegments[i]
    else if (seg !== reqSegments[i]) return null
  }
  return params
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
          const params = matchRoute(r.segments, reqSegments)
          if (!params) continue

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
