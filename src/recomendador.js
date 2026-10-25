// Motor de recomendación: perfil de gustos a partir de las estrellas,
// y afinidad coseno entre ese perfil y las etiquetas de cada candidato.

const PESO = { 1: -1, 2: -0.5, 3: 0.15, 4: 0.7, 5: 1 }

/** Una serie dejada a medias pesa menos que una terminada. */
export function pesoDe(item, marca) {
  const w = PESO[marca.estrellas]
  if (item.tipo !== 'tv' || !item.temporadas || !marca.temporadas) return w
  const frac = Math.min(1, marca.temporadas / item.temporadas)
  return w > 0 ? w * (0.6 + 0.4 * frac) : w
}

export function perfil(vistos) {
  const tags = {}
  for (const { item, marca } of vistos) {
    const w = pesoDe(item, marca)
    ;(item.tags || []).forEach((t) => {
      tags[t] = (tags[t] || 0) + w
    })
  }
  return { tags, norma: Math.sqrt(Object.values(tags).reduce((a, v) => a + v * v, 0)) }
}

export function afinidad(item, p) {
  const tags = item.tags || []
  if (!p.norma || !tags.length) return 0
  const dot = tags.reduce((a, t) => a + (p.tags[t] || 0), 0)
  return Math.max(-1, Math.min(1, dot / (p.norma * Math.sqrt(tags.length + 0.64))))
}

export const porcentaje = (v) => Math.round(Math.max(0, Math.min(100, 50 + v * 58)))

/** Por qué aparece: el título mejor calificado con el que más comparte. */
export function razon(item, vistos) {
  let mejor = null
  let comunes = []
  for (const { item: ref, marca } of vistos) {
    if (marca.estrellas < 4) continue
    const sh = (item.tags || []).filter((t) => (ref.tags || []).includes(t))
    if (sh.length > comunes.length) {
      mejor = ref
      comunes = sh
    }
  }
  if (!mejor || !comunes.length) return null
  return `Porque te gustó ${mejor.titulo}: ${comunes.slice(0, 2).join(' y ')}.`
}

export function topTags(p, n = 5) {
  return Object.entries(p.tags)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}
