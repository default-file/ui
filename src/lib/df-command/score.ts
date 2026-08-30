export type MatchRange = {
  start: number
  end: number
}

export type FuzzyScore = {
  score: number
  ranges: MatchRange[]
}

const BONUS_EXACT_PREFIX = 24
const BONUS_WORD_START = 12
const BONUS_CONSECUTIVE = 8
const BONUS_BOUNDARY = 4
const PENALTY_GAP = 2
const PENALTY_LEADING = 1

function isWordBoundary(text: string, index: number): boolean {
  if (index <= 0) return true
  const prev = text[index - 1]
  const curr = text[index]
  if (prev == null || curr == null) return false
  if (/[\s\-_/.:]/.test(prev)) return true
  if (prev === prev.toLowerCase() && curr === curr.toUpperCase()) return true
  return false
}

function mergeRanges(indices: number[]): MatchRange[] {
  if (indices.length === 0) return []
  const ranges: MatchRange[] = []
  let start = indices[0]!
  let end = start + 1
  for (let i = 1; i < indices.length; i++) {
    const index = indices[i]!
    if (index === end) {
      end = index + 1
      continue
    }
    ranges.push({ start, end })
    start = index
    end = index + 1
  }
  ranges.push({ start, end })
  return ranges
}

/**
 * Case insensitive subsequence match with bonuses for exact prefixes,
 * word starts, and consecutive runs. Returns null when the query does not match.
 */
export function scoreFuzzy(query: string, text: string): FuzzyScore | null {
  const q = query.trim().toLowerCase()
  if (q.length === 0) {
    return { score: 0, ranges: [] }
  }

  const source = text
  const lower = source.toLowerCase()
  if (q.length > lower.length) return null

  const matched: number[] = []
  let score = 0
  let qIndex = 0
  let consecutive = 0
  let prevMatch = -1

  for (let i = 0; i < lower.length && qIndex < q.length; i++) {
    if (lower[i] !== q[qIndex]) {
      consecutive = 0
      continue
    }

    matched.push(i)
    if (prevMatch === -1) {
      score -= i * PENALTY_LEADING
    } else if (i === prevMatch + 1) {
      consecutive += 1
      score += BONUS_CONSECUTIVE * consecutive
    } else {
      consecutive = 0
      score -= (i - prevMatch - 1) * PENALTY_GAP
    }

    if (isWordBoundary(source, i)) {
      score += BONUS_WORD_START
    } else if (i > 0 && /[0-9]/.test(source[i]!) && /[^0-9]/.test(source[i - 1]!)) {
      score += BONUS_BOUNDARY
    }

    prevMatch = i
    qIndex += 1
  }

  if (qIndex < q.length) return null

  if (lower.startsWith(q)) {
    score += BONUS_EXACT_PREFIX
  }

  score += Math.max(0, 32 - (lower.length - q.length))

  return {
    score,
    ranges: mergeRanges(matched),
  }
}

/** Compare two fuzzy scores descending; stable by label when tied. */
export function compareFuzzyScores(
  a: { score: number; label: string },
  b: { score: number; label: string }
): number {
  if (b.score !== a.score) return b.score - a.score
  return a.label.localeCompare(b.label)
}
