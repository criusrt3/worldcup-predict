import { GROUPS } from './data'
import { EN_TO_CN } from './teamMap'
import type { LiveMatch } from './liveScore'

export interface TeamSearchEntry {
  name: string
  flag: string
  group: string
  searchKey: string
}

let cachedEntries: TeamSearchEntry[] | null = null

export function getTeamSearchEntries(): TeamSearchEntry[] {
  if (cachedEntries) return cachedEntries

  const enByCn = new Map<string, string[]>()
  for (const [en, cn] of Object.entries(EN_TO_CN)) {
    const list = enByCn.get(cn) ?? []
    if (!list.includes(en)) list.push(en)
    enByCn.set(cn, list)
  }

  cachedEntries = GROUPS.flatMap((g) =>
    g.teams.map((t) => ({
      name: t.name,
      flag: t.flag,
      group: g.id,
      searchKey: [t.name, g.id, `${g.id}组`, ...(enByCn.get(t.name) ?? [])].join(' ').toLowerCase(),
    })),
  )
  return cachedEntries
}

/** 子串 + 字符顺序模糊匹配 */
export function fuzzyMatchTeam(query: string, searchKey: string, displayName: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${searchKey} ${displayName}`.toLowerCase()
  if (hay.includes(q)) return true
  let i = 0
  for (const c of hay) {
    if (c === q[i]) i++
    if (i >= q.length) return true
  }
  return false
}

export function filterMatchesByTeam(matches: LiveMatch[], team: string): LiveMatch[] {
  if (!team) return matches
  return matches.filter((m) => m.home.name === team || m.away.name === team)
}
