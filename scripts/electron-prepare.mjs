// Prépare le build Next.js standalone pour l'empaquetage Electron.
// Lance : next build, puis copie .next/static et public/ dans .next/standalone/
import { execSync } from 'child_process'
import { cpSync, existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

console.log('▶ next build...')
execSync('npx next build', { stdio: 'inherit', cwd: root, env: { ...process.env, ELECTRON_BUILD: 'true' } })

const standaloneDir = join(root, '.next', 'standalone')
const staticSrc = join(root, '.next', 'static')
const staticDest = join(standaloneDir, '.next', 'static')
const publicSrc = join(root, 'public')
const publicDest = join(standaloneDir, 'public')

if (!existsSync(standaloneDir)) {
  console.error('❌ .next/standalone introuvable. Vérifiez que output: "standalone" est dans next.config.mjs')
  process.exit(1)
}

if (existsSync(staticDest)) rmSync(staticDest, { recursive: true })
cpSync(staticSrc, staticDest, { recursive: true })
console.log('✓ .next/static copié')

if (existsSync(publicDest)) rmSync(publicDest, { recursive: true })
cpSync(publicSrc, publicDest, { recursive: true })
console.log('✓ public/ copié')

console.log('✓ Prêt pour electron-builder')
