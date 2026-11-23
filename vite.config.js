import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Deploy base path.
 *
 * GitHub Pages serves this repository from /JULIE/, so assets must be
 * requested from that subpath. Vite exposes whatever we set here as
 * `import.meta.env.BASE_URL`, which is how the song URL is built — so
 * the same build works at a domain root (local dev) and under the
 * repository subpath (Pages) with no hardcoded paths anywhere.
 *
 * Override with VITE_BASE_PATH if the site ever moves to a custom domain.
 */
const base = process.env.VITE_BASE_PATH || '/JULIE/'

/**
 * Juliet's song.
 *
 * The track was added at the repository root and must stay there, so it
 * is not inside `public/` where Vite would normally pick it up. This
 * plugin makes it available at the same URL the app requests in every
 * mode — dev server, preview, and production build — without moving or
 * duplicating the source file in the repository. (The copy that ends up
 * in `dist/` is a build artifact, and `dist/` is gitignored.)
 */
const SONG_FILE = 'Holy Place – Abundant Worship Lyrics Video.mp3'
const SONG_URL = `/${encodeURIComponent(SONG_FILE)}`

function julietSong() {
  const source = () => path.resolve(process.cwd(), SONG_FILE)

  return {
    name: 'juliet-song-asset',

    // Serve the track in dev and preview, with range support so iOS
    // Safari can seek and stream it properly.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        let decoded = url
        try {
          decoded = decodeURIComponent(url)
        } catch {
          /* malformed encoding — let Vite deal with it */
        }

        if (!decoded.endsWith(SONG_FILE)) return next()

        const file = source()
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          return res.end('Song file not found')
        }

        const { size } = fs.statSync(file)
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Cache-Control', 'public, max-age=3600')

        const range = req.headers.range
        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range)
          const start = match && match[1] ? parseInt(match[1], 10) : 0
          const end =
            match && match[2] ? parseInt(match[2], 10) : Math.min(size - 1, start + 2_000_000)
          res.statusCode = 206
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
          res.setHeader('Content-Length', end - start + 1)
          fs.createReadStream(file, { start, end }).pipe(res)
        } else {
          res.statusCode = 200
          res.setHeader('Content-Length', size)
          if (req.method === 'HEAD') return res.end()
          fs.createReadStream(file).pipe(res)
        }
      })
    },

    // Copy the track into the build output at the exact name the app asks for
    writeBundle(options) {
      const file = source()
      if (!fs.existsSync(file)) {
        this.warn(`[juliet] song missing at ${file}`)
        return
      }
      const outDir = options.dir || path.resolve(process.cwd(), 'dist')
      fs.copyFileSync(file, path.join(outDir, SONG_FILE))
      this.info?.(`[juliet] bundled ${SONG_FILE} → ${SONG_URL}`)
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), julietSong()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})
