// Proxy de OMDb: notas de IMDb, Rotten Tomatoes y Metacritic por imdb_id.
// Requiere la variable de entorno OMDB_API_KEY en el panel del proveedor.

import { authenticate } from './_auth.js'

export default async function handler(req, res) {
  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const key = process.env.OMDB_API_KEY?.trim()
  if (!key) return res.status(500).json({ error: 'Falta OMDB_API_KEY' })

  const url = new URL(req.url, 'http://local')
  const imdbId = (url.searchParams.get('i') || '').trim()
  if (!/^tt\d{5,10}$/.test(imdbId)) {
    return res.status(400).json({ error: 'Falta un imdb_id válido' })
  }

  const upstream = `https://www.omdbapi.com/?apikey=${key}&i=${imdbId}`
  const r = await fetch(upstream)
  const body = await r.text()

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate')
  return res.status(r.status).send(body)
}
