import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /tmdb/* se reenvía a api.themoviedb.org y la key se añade aquí,
// en el servidor. Nunca llega al bundle del navegador.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/tmdb': {
          target: 'https://api.themoviedb.org/3',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/tmdb/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (!env.TMDB_API_KEY) return
              const sep = proxyReq.path.includes('?') ? '&' : '?'
              proxyReq.path += `${sep}api_key=${env.TMDB_API_KEY}`
            })
          }
        }
      }
    }
  }
})
