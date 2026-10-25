// Recommendation engine: pure, no network or UI, so it can be tested.
// Explainable heuristic: cosine similarity between the user's profile and each
// title's traits, plus quality and novelty. It trains nothing on TMDB data (see terms).

export type Traits = string[] // typed tags: "genre:18", "kw:1234", "actor:99"

export type Signal = {
  traits: Traits
  weight: number // positive = liked it, negative = not interested
}

export type Profile = Map<string, number>

/** Sums the signals into a sparse vector. */
export function buildProfile(signals: Signal[]): Profile {
  const profile: Profile = new Map()
  for (const { traits, weight } of signals) {
    for (const trait of traits) profile.set(trait, (profile.get(trait) ?? 0) + weight)
  }
  return profile
}

const norm = (vector: Map<string, number>) =>
  Math.sqrt([...vector.values()].reduce((sum, x) => sum + x * x, 0))

/** Cosine between the profile and a title's traits, in [-1, 1]. */
export function affinity(traits: Traits, profile: Profile): number {
  const n = norm(profile)
  if (!n || !traits.length) return 0
  const dot = traits.reduce((sum, t) => sum + (profile.get(t) ?? 0), 0)
  return Math.max(-1, Math.min(1, dot / (n * Math.sqrt(traits.length + 0.64))))
}

export const toPercent = (value: number) =>
  Math.round(Math.max(0, Math.min(100, 50 + value * 58)))

/** Bayesian average: a title with few votes cannot spike on a high rating alone. */
export function quality(voteAverage: number, voteCount: number, prior = 6.5, minimum = 200): number {
  const weight = voteCount / (voteCount + minimum)
  return weight * voteAverage + (1 - weight) * prior
}

/** Novelty bonus that halves every 180 days after release. */
export function novelty(releaseDate: string | null, today: Date): number {
  if (!releaseDate) return 0
  const days = (today.getTime() - new Date(releaseDate).getTime()) / 86_400_000
  if (days < 0) return 0
  return Math.pow(0.5, days / 180)
}

export type Candidate = {
  key: string
  traits: Traits
  voteAverage: number
  voteCount: number
  releaseDate: string | null
  // how many of your favourites suggest it (collaborative signal)
  suggestedBy: number
}

export type Scored = Candidate & { score: number; match: number }

export const WEIGHTS = {
  affinity: 1,
  collaborative: 0.25,
  quality: 0.35,
  novelty: 0.15,
}

/** Combined score. The weights are the only tunable part of the engine. */
export function score(
  candidate: Candidate,
  profile: Profile,
  today: Date,
  weights = WEIGHTS,
): Scored {
  const affinityValue = affinity(candidate.traits, profile)
  const total =
    weights.affinity * affinityValue +
    weights.collaborative * Math.log1p(candidate.suggestedBy) +
    (weights.quality * (quality(candidate.voteAverage, candidate.voteCount) - 6.5)) / 3.5 +
    weights.novelty * novelty(candidate.releaseDate, today)
  return { ...candidate, score: total, match: toPercent(affinityValue) }
}

/** Jaccard similarity between two titles' traits. Used by MMR. */
export function similarity(a: Traits, b: Traits): number {
  if (!a.length || !b.length) return 0
  const setA = new Set(a)
  const common = b.filter((t) => setA.has(t)).length
  return common / (a.length + b.length - common)
}

/**
 * MMR re-ranking: balances relevance and diversity so the top is not ten clones
 * of the same saga or director. lambda = 1 ignores diversity; lambda = 0 only looks at it.
 */
export function mmr(list: Scored[], count: number, lambda = 0.7): Scored[] {
  const remaining = [...list].sort((a, b) => b.score - a.score)
  const picked: Scored[] = []
  while (picked.length < count && remaining.length) {
    let bestIndex = 0
    let bestValue = -Infinity
    remaining.forEach((candidate, index) => {
      const maxSimilarity = picked.reduce(
        (max, p) => Math.max(max, similarity(candidate.traits, p.traits)),
        0,
      )
      const value = lambda * candidate.score - (1 - lambda) * maxSimilarity
      if (value > bestValue) {
        bestValue = value
        bestIndex = index
      }
    })
    picked.push(remaining.splice(bestIndex, 1)[0])
  }
  return picked
}

/** Deterministic generator (mulberry32), so a seeded random order is reproducible. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * "Surprise me": weighted sampling (softmax with temperature) among candidates
 * above a minimum affinity. Higher temperature = more exploration.
 */
export function sample(
  list: Scored[],
  count: number,
  temperature: number,
  random: () => number,
  minMatch = 40,
): Scored[] {
  const pool = list.filter((c) => c.match >= minMatch)
  const result: Scored[] = []
  while (result.length < count && pool.length) {
    const max = Math.max(...pool.map((c) => c.score))
    const weights = pool.map((c) => Math.exp((c.score - max) / temperature))
    const total = weights.reduce((sum, w) => sum + w, 0)
    let roll = random() * total
    let index = 0
    for (; index < pool.length - 1; index++) {
      roll -= weights[index]
      if (roll <= 0) break
    }
    result.push(pool.splice(index, 1)[0])
  }
  return result
}

/** Human-readable reasons: the traits that contributed most to this title's score. */
export function reasons(
  traits: Traits,
  profile: Profile,
  names: Map<string, string>,
  count = 2,
): string[] {
  return traits
    .map((trait) => ({ trait, value: profile.get(trait) ?? 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((x) => names.get(x.trait) ?? x.trait)
}
