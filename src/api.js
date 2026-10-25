// Cliente de TMDB. Todas las llamadas pasan por /tmdb, que es el proxy
// (vite.config.js en desarrollo, api/tmdb.js en producción) donde vive la key.

const IDIOMA = 'es-ES'
const cache = new Map()

async function tmdb(path, params = {}) {
  const qs = new URLSearchParams({ language: IDIOMA, ...params }).toString()
  const url = `/tmdb${path}?${qs}`
  if (cache.has(url)) return cache.get(url)
  const res = await fetch(url)
  if (!res.ok) {
    const detalle = res.status === 401 ? 'Falta o es inválida TMDB_API_KEY.' : ''
    throw new Error(`TMDB ${res.status} en ${path}. ${detalle}`)
  }
  const data = await res.json()
  cache.set(url, data)
  return data
}

export const poster = (p, size = 'w342') =>
  p ? `https://image.tmdb.org/t/p/${size}${p}` : null

const GENEROS = new Map()
async function nombreGenero(id, tipo) {
  if (!GENEROS.size) {
    const [m, t] = await Promise.all([
      tmdb('/genre/movie/list'),
      tmdb('/genre/tv/list')
    ])
    ;[...m.genres, ...t.genres].forEach((g) => GENEROS.set(g.id, g.name.toLowerCase()))
  }
  return GENEROS.get(id)
}

function normaliza(raw, tipo) {
  const fecha = raw.release_date || raw.first_air_date || ''
  return {
    key: `${tipo}:${raw.id}`,
    id: raw.id,
    tipo, // 'movie' | 'tv'
    titulo: raw.title || raw.name,
    anio: fecha ? Number(fecha.slice(0, 4)) : null,
    poster: poster(raw.poster_path),
    sinopsis: raw.overview || '',
    generosIds: raw.genre_ids || (raw.genres || []).map((g) => g.id),
    votoTmdb: raw.vote_average || 0
  }
}

/** Catálogo inicial: lo popular y lo mejor valorado, cine y TV. */
export async function catalogo() {
  const fuentes = [
    ['/movie/popular', 'movie', 1],
    ['/movie/popular', 'movie', 2],
    ['/movie/top_rated', 'movie', 1],
    ['/tv/popular', 'tv', 1],
    ['/tv/top_rated', 'tv', 1]
  ]
  const partes = await Promise.all(
    fuentes.map(([p, tipo, page]) =>
      tmdb(p, { page }).then((d) => d.results.map((r) => normaliza(r, tipo)))
    )
  )
  const vistos = new Set()
  const items = []
  for (const it of partes.flat()) {
    if (vistos.has(it.key) || !it.poster) continue
    vistos.add(it.key)
    items.push(it)
  }
  await Promise.all(items.map(etiqueta))
  return items
}

/** Géneros + palabras clave: el vocabulario con el que se compara el gusto. */
export async function etiqueta(item) {
  if (item.tags) return item
  const nombres = await Promise.all(item.generosIds.map((g) => nombreGenero(g, item.tipo)))
  item.tags = nombres.filter(Boolean)
  return item
}

/** Detalle: temporadas reales de una serie y palabras clave del título. */
export async function detalle(item) {
  if (item.detallado) return item
  const d = await tmdb(`/${item.tipo}/${item.id}`, {
    append_to_response: 'keywords'
  })
  const kw = d.keywords?.keywords || d.keywords?.results || []
  await etiqueta(item)
  item.tags = [...new Set([...item.tags, ...kw.slice(0, 8).map((k) => k.name.toLowerCase())])]
  item.temporadas = d.number_of_seasons || 0
  item.duracion = d.runtime || d.episode_run_time?.[0] || null
  item.detallado = true
  return item
}

/** Candidatos que TMDB asocia a un título que te gustó. */
export async function similares(item) {
  const d = await tmdb(`/${item.tipo}/${item.id}/recommendations`)
  const items = d.results.filter((r) => r.poster_path).map((r) => normaliza(r, item.tipo))
  await Promise.all(items.map(etiqueta))
  return items
}

export async function buscar(query) {
  if (!query.trim()) return []
  const d = await tmdb('/search/multi', { query, include_adult: 'false' })
  const items = d.results
    .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
    .map((r) => normaliza(r, r.media_type))
  await Promise.all(items.map(etiqueta))
  return items
}
