// Rasterises public/icon.svg into the PNG icons the PWA manifest needs.
// Run once with `npm run icons` (needs the `sharp` devDependency).
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'public/icon.svg'))

const maskableSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0ea678"/>
  <g transform="translate(96 96) scale(0.625)">${readFileSync(resolve(root, 'public/icon.svg')).toString().replace(/<\?xml.*?\?>/, '')}</g>
</svg>`)

const jobs = [
  { input: svg, size: 192, out: 'public/pwa-192.png' },
  { input: svg, size: 512, out: 'public/pwa-512.png' },
  { input: maskableSvg, size: 512, out: 'public/pwa-maskable-512.png' },
  { input: svg, size: 180, out: 'public/apple-touch-icon.png' },
  { input: svg, size: 32, out: 'public/favicon-32.png' },
]

for (const j of jobs) {
  const buf = await sharp(j.input, { density: 384 }).resize(j.size, j.size).png().toBuffer()
  writeFileSync(resolve(root, j.out), buf)
  console.log('wrote', j.out)
}

// minimal .ico = the 32px png bytes are fine for modern browsers referencing favicon.ico
writeFileSync(
  resolve(root, 'public/favicon.ico'),
  await sharp(svg, { density: 384 }).resize(48, 48).png().toBuffer(),
)
console.log('wrote public/favicon.ico')
