// Proxy para producción (Vercel / Netlify functions con adaptador).
// El navegador llama /tmdb/movie/popular?page=1 y la key se añade aquí.
// Requiere la variable de entorno TMDB_API_KEY en el panel del proveedor.

export default async function handler(req, res) {
  const key = process.env.TMDB_API_KEY
  if (!key) return res.status(500).json({ error: 'Falta TMDB_API_KEY' })

  const url = new URL(req.url, 'http://local')
  const path = (url.searchParams.get('path') || '').replace(/^\/+/, '')
  if (!path) return res.status(400).json({ error: 'Falta el parámetro path' })

  url.searchParams.delete('path')
  url.searchParams.set('api_key', key)

  const upstream = `https://api.themoviedb.org/3/${path}?${url.searchParams}`
  const r = await fetch(upstream)
  const body = await r.text()

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.status(r.status).send(body)
}
