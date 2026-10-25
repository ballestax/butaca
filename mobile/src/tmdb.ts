// TMDB client for the app. Every call goes through the Vercel proxy (api/tmdb.js),
// so the API key never reaches the device.

export const BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://butaca.vercel.app'
const LANGUAGE = 'es-ES'
const MAX_CONCURRENCY = 8
const MAX_RETRIES = 3

export type MediaType = 'movie' | 'tv'

// Queue that caps in-flight requests, plus a retry that honours Retry-After (429).
let inFlight = 0
const waiting: (() => void)[] = []
const pending = new Map<string, Promise<unknown>>()

async function slot<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve))
  inFlight++
  try {
    return await task()
  } finally {
    inFlight--
    waiting.shift()?.()
  }
}

// The session token is registered once the user logs in (see the auth module).
let getToken: () => Promise<string | null> = async () => null
export const setTokenProvider = (provider: () => Promise<string | null>) => {
  getToken = provider
}

async function request(url: string, attempt = 0): Promise<unknown> {
  const token = await getToken()
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const seconds = Number(res.headers.get('Retry-After')) || 1 + attempt
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    return request(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${url}`)
  return res.json()
}

/** Deduplicated request: two screens asking for the same thing share one response. */
export function tmdb<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ language: LANGUAGE, ...params }).toString()
  const url = `${BASE}/tmdb${path}?${query}`
  if (!pending.has(url)) {
    const promise = slot(() => request(url)).finally(() => pending.delete(url))
    pending.set(url, promise)
  }
  return pending.get(url) as Promise<T>
}

export const posterUrl = (path: string | null, size: 'w92' | 'w342' | 'w780' = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

/** Internal shape of a title, whether it is a movie or a series. */
export type Title = {
  key: string
  id: number
  type: MediaType
  title: string
  year: number | null
  poster: string | null
  overview: string
  voteCount: number
  voteAverage: number
  genreIds: number[]
}

export function normalize(raw: any, type: MediaType): Title {
  const date: string = raw.release_date || raw.first_air_date || ''
  return {
    key: `${type}:${raw.id}`,
    id: raw.id,
    type,
    title: raw.title || raw.name,
    year: date ? Number(date.slice(0, 4)) : null,
    poster: posterUrl(raw.poster_path),
    overview: raw.overview ?? '',
    voteCount: raw.vote_count ?? 0,
    voteAverage: raw.vote_average ?? 0,
    genreIds: raw.genre_ids ?? (raw.genres ?? []).map((g: any) => g.id),
  }
}

/**
 * Full details in one call: genres, keywords, cast, director, runtime and seasons.
 * This is what feeds the recommender's trait vector.
 */
export async function details(title: Title) {
  const d = await tmdb(`/${title.type}/${title.id}`, {
    append_to_response: 'keywords,credits,external_ids',
  })
  const keywords: { id: number; name: string }[] = d.keywords?.keywords ?? d.keywords?.results ?? []
  const cast: string[] = (d.credits?.cast ?? []).slice(0, 5).map((p: any) => `actor:${p.id}`)
  const crew: any[] = d.credits?.crew ?? []
  const directors = crew.filter((p) => p.job === 'Director').map((p) => `director:${p.id}`)
  return {
    genres: (d.genres ?? []).map((g: any) => `genre:${g.id}`),
    keywords: keywords.map((k) => `kw:${k.id}`),
    keywordNames: keywords.map((k) => k.name.toLowerCase()),
    people: [...cast, ...directors],
    decade: title.year ? `decade:${Math.floor(title.year / 10) * 10}` : null,
    language: d.original_language ? `language:${d.original_language}` : null,
    runtime: d.runtime || d.episode_run_time?.[0] || null,
    seasons: d.number_of_seasons ?? 0,
    imdbId: d.external_ids?.imdb_id ?? d.imdb_id ?? null,
    releaseDate: d.release_date || d.first_air_date || null,
    inProduction: d.in_production ?? false,
    nextEpisodeAirDate: d.next_episode_to_air?.air_date ?? null,
  }
}

export type Details = Awaited<ReturnType<typeof details>>
