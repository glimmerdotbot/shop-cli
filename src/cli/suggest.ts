/** Simple fuzzy matching: check if all chars of needle appear in haystack in order */
const fuzzyMatch = (needle: string, haystack: string): boolean => {
  const lowerNeedle = needle.toLowerCase()
  const lowerHaystack = haystack.toLowerCase()
  let ni = 0
  for (let hi = 0; hi < lowerHaystack.length && ni < lowerNeedle.length; hi++) {
    if (lowerHaystack[hi] === lowerNeedle[ni]) ni++
  }
  return ni === lowerNeedle.length
}

const tokenize = (value: string): string[] =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

const levenshteinDistance = (a: string, b: string, maxDistance = 3): number => {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Early exit for very different lengths
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1

  const v0 = new Array<number>(b.length + 1)
  const v1 = new Array<number>(b.length + 1)

  for (let i = 0; i <= b.length; i++) v0[i] = i

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1
    let bestInRow = v1[0]!
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1
      v1[j + 1] = Math.min(
        v1[j]! + 1, // insertion
        v0[j + 1]! + 1, // deletion
        v0[j]! + cost, // substitution
      )
      if (v1[j + 1]! < bestInRow) bestInRow = v1[j + 1]!
    }

    if (bestInRow > maxDistance) return maxDistance + 1
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j]!
  }

  return v1[b.length]!
}

/** Score a match - lower is better. Prefers exact/prefix/substring, then small edit distance, then fuzzy. */
const scoreMatchDefault = (query: string, candidate: string): number => {
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()

  if (c === q) return 0
  // Prefer simple pluralization ("product" -> "products") over other prefix matches ("product-feeds").
  if (c === `${q}s` || c === `${q}es`) return 1
  if (c.startsWith(q)) return 2
  if (q.startsWith(c)) return 3
  if (c.includes(q)) return 4
  if (q.includes(c)) return 5

  const dist = levenshteinDistance(q, c, 3)
  if (dist <= 3) return 10 + dist

  if (fuzzyMatch(query, candidate)) return 20
  if (fuzzyMatch(candidate, query)) return 21
  return Infinity
}

/**
 * Score a match for schema field names and input keys.
 *
 * Builds on the default scorer, then adds:
 * - suffix/token affinity (e.g. bodyHtml -> descriptionHtml via shared "html" suffix token)
 * - token overlap fallback, when edit distance is too large for default scoring
 */
const scoreMatchField = (query: string, candidate: string): number => {
  const base = scoreMatchDefault(query, candidate)
  if (base < Infinity) return base

  const qTokens = tokenize(query)
  const cTokens = tokenize(candidate)

  const qLast = qTokens[qTokens.length - 1]
  const cLast = cTokens[cTokens.length - 1]

  if (qLast && cLast && qLast === cLast) {
    return 30
  }

  const cSet = new Set(cTokens)
  let overlap = 0
  for (const t of qTokens) if (cSet.has(t)) overlap++
  if (overlap > 0) {
    // More overlap is better (lower score).
    return 40 - Math.min(overlap, 5)
  }

  return Infinity
}

export const findSuggestions = ({
  query,
  candidates,
  limit = 3,
  mode = 'default',
}: {
  query: string
  candidates: string[]
  limit?: number
  mode?: 'default' | 'field'
}): string[] => {
  const scoreMatch = mode === 'field' ? scoreMatchField : scoreMatchDefault
  const scored = candidates
    .map((name) => ({ name, score: scoreMatch(query, name) }))
    .filter(({ score }) => score < Infinity)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)

  return scored.map(({ name }) => name)
}
