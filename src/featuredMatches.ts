import { FEATURED_MATCHES, findGroupByTeam, findTeam } from './data'
import { buildTournamentContext } from './groupStandings'
import {
  formatBeijingClock,
  getBeijingDateKey,
  getTodayBeijingDateKey,
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

export interface FocusDayBundle {
  dateKey: string
  matches: LiveMatch[]
}

function toMatchStage(stage: string): MatchStage {
  if (stage === '三四名决赛') return '决赛'
  const stages: MatchStage[] = ['小组赛', '32强', '16强', '8强', '半决赛', '决赛']
  return stages.includes(stage as MatchStage) ? (stage as MatchStage) : '小组赛'
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00+08:00`)
  d.setDate(d.getDate() + days)
  return getBeijingDateKey(d.toISOString())
}

function formatFocusDayShort(dateKey: string): string {
  try {
    const d = new Date(`${dateKey}T12:00:00+08:00`)
    return d.toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  } catch {
    return dateKey
  }
}

/** 焦点日：今日有未开赛/进行中 → 今日；否则取最近将有比赛的一天 */
export function resolveFocusDay(matches: LiveMatch[]): FocusDayBundle | null {
  if (!matches.length) return null

  const todayKey = getTodayBeijingDateKey()
  const byDay = new Map<string, LiveMatch[]>()

  for (const m of matches) {
    const day = getBeijingDateKey(m.startTimeIso)
    const list = byDay.get(day) ?? []
    list.push(m)
    byDay.set(day, list)
  }

  const sortedDays = [...byDay.keys()].sort()

  const today = byDay.get(todayKey) ?? []
  if (today.some((m) => m.isLive || m.status === 'scheduled')) {
    return { dateKey: todayKey, matches: sortTodayMatches(today) }
  }

  for (const day of sortedDays) {
    if (day < todayKey) continue
    const list = byDay.get(day)!
    if (list.some((m) => m.isLive || m.status === 'scheduled')) {
      return { dateKey: day, matches: sortTodayMatches(list) }
    }
  }

  if (today.length) {
    return { dateKey: todayKey, matches: sortTodayMatches(today) }
  }

  for (const day of sortedDays) {
    if (day >= todayKey) {
      return { dateKey: day, matches: sortTodayMatches(byDay.get(day)!) }
    }
  }

  const lastDay = sortedDays[sortedDays.length - 1]
  return lastDay ? { dateKey: lastDay, matches: sortTodayMatches(byDay.get(lastDay)!) } : null
}

export function getFeaturedFocusHeader(board: LiveScoreboard | null): { title: string; sub: string } {
  if (!board?.matches.length) {
    return { title: '⚽ 精选对阵', sub: '' }
  }

  const focus = resolveFocusDay(board.matches)
  if (!focus) {
    return { title: '⚽ 精选对阵', sub: '' }
  }

  const todayKey = getTodayBeijingDateKey()
  const tomorrowKey = addDaysToDateKey(todayKey, 1)
  const upcoming = focus.matches.filter((m) => m.isLive || m.status === 'scheduled').length

  let title = '📅 今日焦点'
  if (focus.dateKey === tomorrowKey) title = '📅 明日赛程'
  else if (focus.dateKey !== todayKey) title = `📅 ${formatFocusDayShort(focus.dateKey)}`

  let sub = ''
  if (focus.dateKey === todayKey) {
    sub = upcoming ? `今日 ${focus.matches.length} 场 · 自动更新` : `今日已完赛 ${focus.matches.length} 场`
  } else {
    sub = upcoming
      ? `即将开赛 · 共 ${focus.matches.length} 场（北京时间）`
      : `${formatFocusDayShort(focus.dateKey)} · 共 ${focus.matches.length} 场`
  }

  return { title, sub }
}

function labelForMatch(m: LiveMatch, board: LiveScoreboard, focusDateKey: string): string {
  if (m.isLive) return '🔴 进行中'
  if (m.status === 'finished') {
    return getBeijingDateKey(m.startTimeIso) === getTodayBeijingDateKey() ? '今日完场' : '已完场'
  }
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

  return focusDateKey === getTodayBeijingDateKey() ? '今日赛程' : '赛程'
}

function matchKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

function matchToFeatured(m: LiveMatch, board: LiveScoreboard, focusDateKey: string): FeaturedMatchItem {
  const group = findGroupByTeam(m.home.name) ?? (m.group.replace(/\s*组/u, '').trim() || 'A')
  return {
    label: labelForMatch(m, board, focusDateKey),
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

/** 展示焦点日全部赛程；无数据时回退静态精选 */
export function buildFeaturedMatches(board: LiveScoreboard | null): FeaturedMatchItem[] {
  if (!board?.matches.length) return staticFeatured()

  const focus = resolveFocusDay(board.matches)
  if (!focus?.matches.length) return staticFeatured()

  const picked: FeaturedMatchItem[] = []
  const used = new Set<string>()

  const push = (m: LiveMatch) => {
    const key = matchKey(m.home.name, m.away.name)
    if (used.has(key)) return
    used.add(key)
    picked.push(matchToFeatured(m, board, focus.dateKey))
  }

  focus.matches.filter((m) => m.isLive).forEach(push)
  focus.matches.filter((m) => m.status === 'scheduled').forEach(push)
  focus.matches.filter((m) => m.status === 'finished').forEach(push)

  return picked.length ? picked : staticFeatured()
}

export function hasFocusFeatured(board: LiveScoreboard | null): boolean {
  return !!board && !!resolveFocusDay(board.matches)?.matches.length
}

/** @deprecated 使用 hasFocusFeatured */
export function hasTodayFeatured(board: LiveScoreboard | null): boolean {
  return hasFocusFeatured(board)
}
