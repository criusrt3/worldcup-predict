import { GROUPS } from './data'
import { TIER_LABELS } from './data'
import { getTeamProfile, type TeamProfile } from './skillEngine'

/** FIFA 世界排名（2026 年 6 月初估算，仅供 UI 参考） */
export const FIFA_WORLD_RANK: Record<string, number> = {
  阿根廷: 1,
  法国: 2,
  西班牙: 3,
  英格兰: 4,
  巴西: 5,
  葡萄牙: 6,
  荷兰: 7,
  德国: 8,
  比利时: 9,
  克罗地亚: 10,
  摩洛哥: 11,
  哥伦比亚: 12,
  日本: 13,
  美国: 14,
  瑞士: 15,
  乌拉圭: 16,
  墨西哥: 17,
  奥地利: 18,
  挪威: 19,
  塞内加尔: 20,
  韩国: 21,
  厄瓜多尔: 22,
  澳大利亚: 23,
  土耳其: 24,
  瑞典: 25,
  埃及: 26,
  伊朗: 27,
  苏格兰: 28,
  捷克: 29,
  加拿大: 30,
  卡塔尔: 31,
  突尼斯: 32,
  阿尔及利亚: 33,
  科特迪瓦: 34,
  巴拉圭: 35,
  加纳: 36,
  波黑: 37,
  巴拿马: 38,
  新西兰: 39,
  沙特: 40,
  伊拉克: 41,
  约旦: 42,
  乌兹别克斯坦: 43,
  南非: 44,
  海地: 45,
  库拉索: 46,
  佛得角: 47,
  刚果金: 48,
}

export interface KeyPlayer {
  name: string
  note?: string
}

export interface TeamDossier {
  name: string
  fifaRank: number
  group: string
  section: string
  tierLabel: string
  summary: string
  summaryBrief: string
  players: KeyPlayer[]
}

/** 从 skill 摘要中提取关键球员 */
export function parseKeyPlayers(summary: string): KeyPlayer[] {
  const players: KeyPlayer[] = []
  const seen = new Set<string>()

  const add = (name: string, note?: string) => {
    const n = name.trim()
    if (n.length < 2 || n.length > 12 || seen.has(n)) return
    if (/隐忧|执教|预选赛|冠军|世界杯|小组|附加赛|晋级|出线/.test(n)) return
    seen.add(n)
    players.push({ name: n, note: note?.trim() || undefined })
  }

  for (const m of summary.matchAll(/([^、，。（\s]{2,12})（([^）]{2,48})）/gu)) {
    add(m[1], m[2])
  }

  const cut = summary.search(/[。；]/)
  const tail = cut >= 0 ? summary.slice(cut + 1) : summary
  for (const chunk of tail.split(/[、，]/)) {
    let s = chunk.trim()
    if (!s || s.startsWith('隐忧')) continue
    const noteM = s.match(/^(.+?)（([^）]+)）$/)
    if (noteM) {
      add(noteM[1], noteM[2])
      continue
    }
    s = s.replace(/（[^）]*）/gu, '').trim()
    if (s.length >= 2 && s.length <= 10) add(s)
  }

  return players.slice(0, 6)
}

function briefSummary(text: string, max = 56): string {
  const s = (text.split(/[。；]/)[0] ?? text).trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export function buildDossierFromProfile(profile: TeamProfile, tier: 1 | 2 | 3 | 4): TeamDossier {
  const team = GROUPS.flatMap((g) => g.teams).find((t) => t.name === profile.name)
  return {
    name: profile.name,
    fifaRank: FIFA_WORLD_RANK[profile.name] ?? 50,
    group: profile.group,
    section: profile.section,
    tierLabel: TIER_LABELS[tier],
    summary: profile.summary,
    summaryBrief: briefSummary(profile.summary),
    players: parseKeyPlayers(profile.summary),
  }
}

let dossierCache: Map<string, TeamDossier> | null = null

export async function loadTeamDossiers(): Promise<Map<string, TeamDossier>> {
  if (dossierCache) return dossierCache

  const map = new Map<string, TeamDossier>()
  for (const g of GROUPS) {
    for (const t of g.teams) {
      const profile = await getTeamProfile(t.name)
      if (profile) {
        map.set(t.name, buildDossierFromProfile(profile, t.tier))
      } else {
        map.set(t.name, {
          name: t.name,
          fifaRank: FIFA_WORLD_RANK[t.name] ?? 50,
          group: g.id,
          section: TIER_LABELS[t.tier],
          tierLabel: TIER_LABELS[t.tier],
          summary: '',
          summaryBrief: TIER_LABELS[t.tier],
          players: [],
        })
      }
    }
  }
  dossierCache = map
  return map
}

export function getCachedDossier(name: string): TeamDossier | null {
  return dossierCache?.get(name) ?? null
}

export function formatFifaRank(rank: number): string {
  return rank <= 50 ? `#${rank}` : '—'
}
