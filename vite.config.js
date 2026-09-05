import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiRoot = path.join(__dirname, 'api')

// Flat api/*.js files only (no bracket-folder routing - Vercel's plain
// Functions builder doesn't support Next.js-style [[...catchAll]] outside
// a Next.js app, so multi-route resources are handled via vercel.json
// rewrites instead; see that file). Files prefixed with "_" are helpers.
function listApiFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'))
    .map((e) => ({ file: path.join(dir, e.name), name: e.name.slice(0, -3) }))
}

// Compiles one vercel.json rewrite rule (`/api/groups/:id` ->
// `/api/groups?id=:id`) into a matcher: given a request path, returns the
// rewritten { path, query } or null if this rule doesn't match.
function compileRewrite({ source, destination }) {
  const paramNames = []
  const pattern = source
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1))
        return '([^/]+)'
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  const re = new RegExp(`^/${pattern}$`)
  const [destPath, destQuery = ''] = destination.split('?')

  return (reqPath) => {
    const m = re.exec(reqPath)
    if (!m) return null
    const params = Object.fromEntries(paramNames.map((name, i) => [name, m[i + 1]]))
    const substitute = (s) => s.replace(/:([A-Za-z0-9_]+)/g, (_, name) => params[name] ?? '')
    const query = Object.fromEntries(
      destQuery
        .split('&')
        .filter(Boolean)
        .map((pair) => pair.split('=').map(substitute)),
    )
    return { path: substitute(destPath), query }
  }
}

// Mounts the api/*.js serverless functions (plus vercel.json's rewrites)
// inside the Vite dev server, so `npm run dev` alone is enough locally -
// no `vercel dev` needed, and routing matches production exactly since
// both read the same vercel.json.
function apiDevPlugin() {
  return {
    name: 'hisheb-api-dev',
    async configureServer(server) {
      const handlers = {}
      for (const { file, name } of listApiFiles(apiRoot)) {
        handlers[name] = (await import(pathToFileURL(file).href)).default
      }
      const vercelJson = JSON.parse(readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'))
      const rewrites = (vercelJson.rewrites || []).map(compileRewrite)

      server.middlewares.use((req, res, next) => {
        let urlPath = req.url.split('?')[0]
        if (!urlPath.startsWith('/api/')) return next()
        let query = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''))

        for (const rewrite of rewrites) {
          const hit = rewrite(urlPath)
          if (hit) {
            urlPath = hit.path
            query = { ...query, ...hit.query }
            break
          }
        }

        const name = urlPath.slice('/api/'.length)
        const handler = handlers[name]
        if (!handler) return next()

        req.query = query
        handler(req, res).catch((err) => {
          console.error('[hisheb] api error', urlPath, err)
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Server error' }))
        })
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
