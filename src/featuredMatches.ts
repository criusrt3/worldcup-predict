import { FEATURED_MATCHES, findGroupByTeam, findTeam } from './data'
import { buildTournamentContext } from './groupStandings'
import {
  filterTodayMatches,
  formatBeijingClock,
  sortTodayMatches,
  type LiveMatch,
  type LiveScoreboard,
} from './liveScore'
import type { MatchStage } from './types'

export interface FeaturedMatchItem {
  label: string
  group: string
  teamA: string
  teamB: string
  stage: MatchStage
  timeHint?: string
  status?: 'live' | 'scheduled' | 'finished'
}

function toMatchStage(stage: string): MatchStage {
  if (stage === '三四名决赛') return '决赛'
  const stages: MatchStage[] = ['小组赛', '32强', '16强', '8强', '半决赛', '决赛']
  return stages.includes(stage as MatchStage) ? (stage as MatchStage) : '小组赛'
}

function labelForMatch(m: LiveMatch, board: LiveScoreboard): string {
  if (m.isLive) return '🔴 进行中'
  if (m.status === 'finished') return '今日完场'
  if (m.stage !== '小组赛') return m.stage

  const home = findTeam(m.home.name)
  const away = findTeam(m.away.name)
  const tH = home?.tier ?? 4
  const tA = away?.tier ?? 4
  const best = Math.min(tH, tA)

  if (best === 1) return '巅峰对决'
  if (tH <= 2 && tA <= 2) return '强强对话'
  if (tH === 1 || tA === 1) return '热门大战'

  const asian = new Set([
    '日本',
    '韩国',
    '沙特',
    '伊朗',
    '澳大利亚',
    '卡塔尔',
    '约旦',
    '乌兹别克斯坦',
    '伊拉克',
  ])
  if (asian.has(m.home.name) || asian.has(m.away.name)) return '亚洲焦点'

  const ctx = buildTournamentContext(board)
  const stH = ctx.byTeam.get(m.home.name)
  const stA = ctx.byTeam.get(m.away.name)
  if (stH?.qualStatus === 'desperate' || stA?.qualStatus === 'desperate') return '生死战'
  if (stH?.qualStatus === 'must_win' || stA?.qualStatus === 'must_win') return '出线关键战'

  return '今日赛程'
}

function matchKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

function matchToFeatured(m: LiveMatch, board: LiveScoreboard): FeaturedMatchItem {
  const group = findGroupByTeam(m.home.name) ?? m.group.replace(/\s*组/u, '').trim() || 'A'
  return {
    label: labelForMatch(m, board),
    group,
    teamA: m.home.name,
    teamB: m.away.name,
    stage: toMatchStage(m.stage),
    timeHint:
      m.isLive ? `${m.clock} · 进行中` : m.status === 'scheduled' ? formatBeijingClock(m.startTimeIso) : '已完场',
    status: m.isLive ? 'live' : m.status === 'finished' ? 'finished' : 'scheduled',
  }
}

function staticFeatured(): FeaturedMatchItem[] {
  return FEATURED_MATCHES.map((m) => ({ ...m }))
}

/** 优先展示今日赛程，不足 4 场时用静态精选补齐 */
export function buildFeaturedMatches(board: LiveScoreboard | null): FeaturedMatchItem[] {
  if (!board?.matches.length) return staticFeatured()

  const today = sortTodayMatches(filterTodayMatches(board.matches))
  if (!today.length) return staticFeatured()

  const picked: FeaturedMatchItem[] = []
  const used = new Set<string>()

  const push = (m: LiveMatch) => {
    const key = matchKey(m.home.name, m.away.name)
    if (used.has(key)) return
    used.add(key)
    picked.push(matchToFeatured(m, board))
  }

  today.filter((m) => m.isLive).forEach(push)
  today.filter((m) => m.status === 'scheduled').forEach(push)
  today.filter((m) => m.status === 'finished').forEach(push)

  const result = picked.slice(0, 4)

  for (const m of FEATURED_MATCHES) {
    if (result.length >= 4) break
    const key = matchKey(m.teamA, m.teamB)
    if (used.has(key)) continue
    used.add(key)
    result.push({ ...m })
  }

  return result
}

export function hasTodayFeatured(board: LiveScoreboard | null): boolean {
  return !!board && filterTodayMatches(board.matches).length > 0
}
