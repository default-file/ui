import { compareFuzzyScores, scoreFuzzy, type MatchRange } from "./score"

export type RankableCommand = {
  id: string
  label: string
  section?: string
  keywords?: string[]
  /** Lower tiers sort before higher tiers. Defaults to 0. */
  rankTier?: number
}

export type RankedCommand<T extends RankableCommand> = {
  command: T
  score: number
  ranges: MatchRange[]
}

/**
 * Rank commands for an empty query: recent ids first (in host order),
 * then remaining commands in their original order.
 */
export function rankRecentFirst<T extends RankableCommand>(
  commands: T[],
  recentIds: string[]
): RankedCommand<T>[] {
  const byId = new Map(commands.map((command) => [command.id, command]))
  const seen = new Set<string>()
  const ranked: RankedCommand<T>[] = []

  for (const id of recentIds) {
    const command = byId.get(id)
    if (!command || seen.has(id)) continue
    seen.add(id)
    ranked.push({ command, score: 0, ranges: [] })
  }

  for (const command of commands) {
    if (seen.has(command.id)) continue
    ranked.push({ command, score: 0, ranges: [] })
  }

  return ranked
}

/** Score and sort commands for a non empty query. */
export function rankByQuery<T extends RankableCommand>(
  commands: T[],
  query: string
): RankedCommand<T>[] {
  const ranked: RankedCommand<T>[] = []

  for (const command of commands) {
    const haystack = [command.label, ...(command.keywords ?? [])].join(" ")
    const labelMatch = scoreFuzzy(query, command.label)
    const keywordMatch =
      labelMatch == null ? scoreFuzzy(query, haystack) : null
    const match = labelMatch ?? keywordMatch
    if (match == null) continue
    ranked.push({
      command,
      score: match.score,
      ranges: labelMatch?.ranges ?? [],
    })
  }

  ranked.sort((a, b) => {
    const tierA = a.command.rankTier ?? 0
    const tierB = b.command.rankTier ?? 0
    if (tierA !== tierB) return tierA - tierB
    return compareFuzzyScores(
      { score: a.score, label: a.command.label },
      { score: b.score, label: b.command.label }
    )
  })

  return ranked
}

/** Merge static and async command lists, preferring the first id wins. */
export function mergeCommands<T extends RankableCommand>(
  primary: T[],
  secondary: T[]
): T[] {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const command of [...primary, ...secondary]) {
    if (seen.has(command.id)) continue
    seen.add(command.id)
    merged.push(command)
  }
  return merged
}
