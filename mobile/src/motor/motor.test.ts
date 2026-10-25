import {
  affinity,
  buildProfile,
  mmr,
  novelty,
  quality,
  sample,
  score,
  seededRandom,
  similarity,
  type Candidate,
  type Scored,
} from './motor'

const scifi = ['genre:878', 'kw:1']
const drama = ['genre:18', 'kw:2']

describe('profile and affinity', () => {
  it('a sci-fi profile recommends sci-fi over drama', () => {
    const profile = buildProfile([{ traits: scifi, weight: 1 }])
    expect(affinity(scifi, profile)).toBeGreaterThan(affinity(drama, profile))
  })

  it('a dislike lowers similar titles', () => {
    const profile = buildProfile([
      { traits: scifi, weight: 1 },
      { traits: scifi, weight: -1 },
    ])
    expect(affinity(scifi, profile)).toBeCloseTo(0)
  })

  it('affinity is zero without a profile', () => {
    expect(affinity(scifi, buildProfile([]))).toBe(0)
  })
})

describe('quality and novelty', () => {
  it('few votes do not inflate the rating', () => {
    expect(quality(10, 3)).toBeLessThan(quality(8, 5000))
  })

  it('novelty decays with time and is never negative', () => {
    const today = new Date('2026-10-01')
    expect(novelty('2026-09-30', today)).toBeGreaterThan(novelty('2025-10-01', today))
    expect(novelty('2027-01-01', today)).toBe(0)
    expect(novelty(null, today)).toBe(0)
  })
})

describe('diversity', () => {
  it('MMR keeps the top from being clones', () => {
    const make = (key: string, traits: string[], value: number): Scored => ({
      key,
      traits,
      voteAverage: 7,
      voteCount: 1000,
      releaseDate: null,
      suggestedBy: 0,
      score: value,
      match: 80,
    })
    const list = [
      make('a', ['saga:x', 'genre:878'], 1.0),
      make('b', ['saga:x', 'genre:878'], 0.99),
      make('c', ['saga:x', 'genre:878'], 0.98),
      make('d', ['genre:878', 'kw:9'], 0.7),
    ]
    const top = mmr(list, 2, 0.5).map((c) => c.key)
    expect(top[0]).toBe('a')
    expect(top[1]).toBe('d')
  })

  it('Jaccard similarity is 1 for identical sets and 0 for disjoint ones', () => {
    expect(similarity(['a', 'b'], ['a', 'b'])).toBe(1)
    expect(similarity(['a'], ['b'])).toBe(0)
  })
})

describe('random order', () => {
  const candidates: Candidate[] = Array.from({ length: 20 }, (_, i) => ({
    key: `movie:${i}`,
    traits: i % 2 ? scifi : drama,
    voteAverage: 7,
    voteCount: 1000,
    releaseDate: null,
    suggestedBy: 0,
  }))
  const profile = buildProfile([{ traits: scifi, weight: 1 }])
  const scored = candidates.map((c) => score(c, profile, new Date('2026-10-01')))

  it('the same seed gives the same order', () => {
    const first = sample(scored, 5, 0.5, seededRandom(42)).map((c) => c.key)
    const second = sample(scored, 5, 0.5, seededRandom(42)).map((c) => c.key)
    expect(first).toEqual(second)
  })

  it('never returns candidates below the minimum match', () => {
    const picked = sample(scored, 20, 1, seededRandom(7), 60)
    picked.forEach((c) => expect(c.match).toBeGreaterThanOrEqual(60))
  })

  it('the generator produces values in [0, 1)', () => {
    const random = seededRandom(123)
    for (let i = 0; i < 1000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
