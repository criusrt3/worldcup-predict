import { teamMetaFromEspn } from './teamMap'

export type LiveMatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished'

export interface LiveTeamSide {
  name: string
  nameEn: string
  flag: string
  color: string
  score: number
  logo?: string
  winner?: boolean
}

export interface LiveMatch {
  id: string
  home: LiveTeamSide
  away: LiveTeamSide
  status: LiveMatchStatus
  statusLabel: string
  clock: string
  periodLabel: string
  startTime: string
  startTimeIso: string
  venue: string
  city: string
  group: string
  stage: string
  /** 完整阶段文案，如「小组赛 · A组」「16强」 */
  stageLabel: string
  stageSlug: string
  isLive: boolean
  attendance?: number
}

export interface LiveScoreboard {
  fetchedAt: string
  matchDate: string
  matches: LiveMatch[]
  liveCount: number
  finishedCount: number
  scheduledCount: number
  totalCount: number
}

interface EspnScoreboard {
  day?: { date?: string }
  events?: EspnEvent[]
}

interface EspnEvent {
  id: string
  date: string
  name: string
  competitions?: EspnCompetition[]
  status?: EspnStatus
}

interface EspnCompetition {
  date: string
  startDate: string
  attendance?: number
  status?: EspnStatus
  venue?: { fullName?: string; address?: { city?: string } }
  altGameNote?: string
  competitors?: EspnCompetitor[]
  season?: { slug?: string }
}

interface EspnStatus {
  clock?: number
  displayClock?: string
  period?: number
  type?: {
    state?: string
    completed?: boolean
    description?: string
    detail?: string
    shortDetail?: string
    name?: string
  }
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  winner?: boolean
  team?: {
    displayName?: string
    abbreviation?: string
    logo?: string
  }
}

const STAGE_MAP: Record<string, string> = {
  'group-stage': '小组赛',
  'round-of-32': '32强',
  'round-of-16': '16强',
  quarterfinal: '8强',
  'quarter-final': '8强',
  semifinal: '半决赛',
  'semi-final': '半决赛',
  final: '决赛',
  'third-place': '三四名决赛',
  'third-place-playoff': '三四名决赛',
}

export const STAGE_ORDER = [
  '小组赛',
  '32强',
  '16强',
  '8强',
  '半决赛',
  '三四名决赛',
  '决赛',
] as const

export type TournamentStage = (typeof STAGE_ORDER)[number]
export type StageFilter = 'all' | TournamentStage

export const TOURNAMENT_START = '20260611'
export const TOURNAMENT_END = '20260719'
/** 48 队扩军：72 场小组赛 + 32 场淘汰赛 */
export const TOURNAMENT_MATCHES_TOTAL = 104
export const BEIJING_TZ = 'Asia/Shanghai'

const beijingDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: BEIJING_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 按北京时间取 YYYY-MM-DD */
export function getBeijingDateKey(iso: string): string {
  return beijingDateFmt.format(new Date(iso))
}

export function getTodayBeijingDateKey(): string {
  return beijingDateFmt.format(new Date())
}

function formatBeijingBase(iso: string | Date, withSeconds = false): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleString('zh-CN', {
    timeZone: BEIJING_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  })
}

/** 北京时间完整日期时间，如 2026年6月17日 12:00 */
export function formatBeijingDateTime(iso: string): string {
  return formatBeijingBase(iso)
}

export function formatKickoffBeijing(iso: string): string {
  return `${formatBeijingDateTime(iso)} 北京时间`
}

export function formatBeijingClock(iso: string): string {
  return formatBeijingDateTime(iso)
}

export function formatBeijingNow(): string {
  return formatBeijingBase(new Date(), true)
}

export function filterTodayMatches(matches: LiveMatch[]): LiveMatch[] {
  const today = getTodayBeijingDateKey()
  return matches.filter((m) => getBeijingDateKey(m.startTimeIso) === today)
}

export function sortTodayMatches(matches: LiveMatch[]): LiveMatch[] {
  const rank: Record<LiveMatchStatus, number> = {
    live: 0,
    halftime: 0,
    scheduled: 1,
    finished: 2,
  }
  return [...matches].sort((a, b) => {
    const dr = rank[a.status] - rank[b.status]
    if (dr !== 0) return dr
    return new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime()
  })
}

function parseGroup(note?: string): string {
  if (!note) return ''
  const m = note.match(/Group\s+([A-L])/i)
  return m ? `${m[1]} 组` : ''
}

export function formatStageLabel(stage: string, group: string): string {
  if (stage === '小组赛') {
    return group ? `小组赛 · ${group}` : '小组赛'
  }
  return stage
}

function stageRibbonKind(stage: string): string {
  if (stage === '小组赛') return 'group'
  if (stage === '决赛' || stage === '三四名决赛') return 'final'
  return 'knockout'
}

export function getStageRibbonKind(stage: string): string {
  return stageRibbonKind(stage)
}

function parseStatus(status?: EspnStatus): {
  status: LiveMatchStatus
  statusLabel: string
  periodLabel: string
  isLive: boolean
} {
  const state = status?.type?.state ?? 'pre'
  const name = status?.type?.name ?? ''
  const detail = status?.type?.shortDetail ?? status?.type?.detail ?? status?.type?.description ?? ''

  if (name.includes('HALFTIME') || detail === 'HT') {
    return { status: 'halftime', statusLabel: '中场休息', periodLabel: '中场', isLive: true }
  }
  if (state === 'in') {
    const period = status?.period ?? 1
    const periodLabel = period === 1 ? '上半场' : period === 2 ? '下半场' : `第 ${period} 阶段`
    return { status: 'live', statusLabel: '进行中', periodLabel, isLive: true }
  }
  if (state === 'post' || status?.type?.completed) {
    return { status: 'finished', statusLabel: '完场', periodLabel: '全场结束', isLive: false }
  }
  return { status: 'scheduled', statusLabel: '未开始', periodLabel: '待开赛', isLive: false }
}

function formatKickoff(iso: string): string {
  return formatKickoffBeijing(iso)
}

function parseEvent(event: EspnEvent): LiveMatch | null {
  const comp = event.competitions?.[0]
  if (!comp?.competitors?.length) return null

  const homeRaw = comp.competitors.find((c) => c.homeAway === 'home') ?? comp.competitors[0]
  const awayRaw = comp.competitors.find((c) => c.homeAway === 'away') ?? comp.competitors[1]
  if (!homeRaw?.team?.displayName || !awayRaw?.team?.displayName) return null
  if (homeRaw === awayRaw) return null

  const homeScore = Number.parseInt(homeRaw.score ?? '0', 10)
  const awayScore = Number.parseInt(awayRaw.score ?? '0', 10)

  const statusInfo = parseStatus(comp.status ?? event.status)
  const slug = comp.season?.slug ?? 'group-stage'
  const group = parseGroup(comp.altGameNote)
  const stage = STAGE_MAP[slug] ?? '小组赛'

  const home = teamMetaFromEspn(homeRaw.team.displayName, homeRaw.team.logo)
  const away = teamMetaFromEspn(awayRaw.team.displayName, awayRaw.team.logo)

  return {
    id: event.id,
    home: {
      ...home,
      score: Number.isNaN(homeScore) ? 0 : homeScore,
      winner: homeRaw.winner,
    },
    away: {
      ...away,
      score: Number.isNaN(awayScore) ? 0 : awayScore,
      winner: awayRaw.winner,
    },
    status: statusInfo.status,
    statusLabel: statusInfo.statusLabel,
    clock: comp.status?.displayClock ?? event.status?.displayClock ?? (statusInfo.isLive ? '进行中' : '-'),
    periodLabel: statusInfo.periodLabel,
    startTime: formatKickoff(comp.startDate ?? event.date),
    startTimeIso: comp.startDate ?? event.date,
    venue: comp.venue?.fullName ?? '',
    city: comp.venue?.address?.city ?? '',
    group,
    stage,
    stageLabel: formatStageLabel(stage, group),
    stageSlug: slug,
    isLive: statusInfo.isLive,
    attendance: comp.attendance,
  }
}

function sortMatches(matches: LiveMatch[], preferLive = true): LiveMatch[] {
  if (!preferLive) {
    return [...matches].sort(
      (a, b) => new Date(b.startTimeIso).getTime() - new Date(a.startTimeIso).getTime(),
    )
  }
  const rank: Record<LiveMatchStatus, number> = {
    live: 0,
    halftime: 0,
    scheduled: 1,
    finished: 2,
  }
  return [...matches].sort((a, b) => {
    const dr = rank[a.status] - rank[b.status]
    if (dr !== 0) return dr
    // 未开始：按开球时间正序（最近要踢的在前）；已完赛：倒序
    if (a.status === 'scheduled' && b.status === 'scheduled') {
      return new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime()
    }
    return new Date(b.startTimeIso).getTime() - new Date(a.startTimeIso).getTime()
  })
}


function formatDateLabel(isoDay: string): string {
  try {
    const d = new Date(`${isoDay}T12:00:00+08:00`)
    return d.toLocaleDateString('zh-CN', {
      timeZone: BEIJING_TZ,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  } catch {
    return isoDay
  }
}

async function fetchEspnEventsInRange(start: string, end: string): Promise<EspnEvent[]> {
  const byId = new Map<string, EspnEvent>()
  const limit = 1000

  for (let page = 1; page <= 5; page++) {
    const query = `?dates=${start}-${end}&limit=${limit}&page=${page}`
    const data = await fetchEspnScoreboard(query)
    const events = data.events ?? []
    if (!events.length) break

    for (const event of events) byId.set(event.id, event)
    if (events.length < limit) break
  }

  return [...byId.values()]
}

async function fetchEspnScoreboard(query = ''): Promise<EspnScoreboard> {
  const paths = [
    `/api/espn/apis/site/v2/sports/soccer/fifa.world/scoreboard${query}`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard${query}`,
  ]

  let lastError: Error | null = null
  for (const url of paths) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`赛况请求失败 (${res.status})`)
      return (await res.json()) as EspnScoreboard
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('赛况加载失败')
    }
  }
  throw lastError ?? new Error('赛况加载失败')
}

function buildScoreboard(data: EspnScoreboard, fallbackDate: string): LiveScoreboard {
  const matches = sortMatches(
    (data.events ?? []).map(parseEvent).filter((m): m is LiveMatch => m != null),
  )
  const finishedCount = matches.filter((m) => m.status === 'finished').length
  const scheduledCount = matches.filter((m) => m.status === 'scheduled').length
  const liveCount = matches.filter((m) => m.isLive).length
  return {
    fetchedAt: formatBeijingNow(),
    matchDate: data.day?.date ?? fallbackDate,
    matches,
    liveCount,
    finishedCount,
    scheduledCount,
    totalCount: matches.length,
  }
}

export function groupFinishedByStage(matches: LiveMatch[]): {
  stage: string
  stageTitle: string
  count: number
  dates: { date: string; label: string; matches: LiveMatch[] }[]
}[] {
  const byStage = new Map<string, LiveMatch[]>()
  for (const m of matches) {
    const list = byStage.get(m.stage) ?? []
    list.push(m)
    byStage.set(m.stage, list)
  }

  const ordered = [
    ...STAGE_ORDER.filter((s) => byStage.has(s)),
    ...[...byStage.keys()].filter((s) => !STAGE_ORDER.includes(s as TournamentStage)),
  ]

  return ordered.map((stage) => {
    const stageMatches = byStage.get(stage)!
    return {
      stage,
      stageTitle: stage === '小组赛' ? '小组赛阶段' : stage,
      count: stageMatches.length,
      dates: groupMatchesByDate(stageMatches),
    }
  })
}

export function countByStage(matches: LiveMatch[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const m of matches) {
    counts[m.stage] = (counts[m.stage] ?? 0) + 1
  }
  return counts
}

export function groupMatchesByDate(matches: LiveMatch[]): { date: string; label: string; matches: LiveMatch[] }[] {
  const map = new Map<string, LiveMatch[]>()
  for (const m of sortMatches(matches, false)) {
    const day = getBeijingDateKey(m.startTimeIso)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(m)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayMatches]) => ({
      date,
      label: formatDateLabel(date),
      matches: dayMatches,
    }))
}

export async function fetchLiveScoreboard(): Promise<LiveScoreboard> {
  const data = await fetchEspnScoreboard()
  return buildScoreboard(data, new Date().toISOString().slice(0, 10))
}

export async function fetchLiveScoreboardByDate(date: Date): Promise<LiveScoreboard> {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const data = await fetchEspnScoreboard(`?dates=${y}${m}${d}`)
  return buildScoreboard(data, `${y}-${m}-${d}`)
}

/** 拉取本届世界杯全赛程（6/11 开幕 ~ 7/19 决赛，含未开始场次） */
export async function fetchTournamentScoreboard(): Promise<LiveScoreboard> {
  const events = await fetchEspnEventsInRange(TOURNAMENT_START, TOURNAMENT_END)

  const matches = sortMatches(
    events.map(parseEvent).filter((m): m is LiveMatch => m != null),
  )

  const finishedCount = matches.filter((m) => m.status === 'finished').length
  const scheduledCount = matches.filter((m) => m.status === 'scheduled').length
  const liveCount = matches.filter((m) => m.isLive).length

  const endLabel = `${TOURNAMENT_END.slice(0, 4)}-${TOURNAMENT_END.slice(4, 6)}-${TOURNAMENT_END.slice(6, 8)}`

  return {
    fetchedAt: formatBeijingNow(),
    matchDate: `${TOURNAMENT_START.slice(0, 4)}-${TOURNAMENT_START.slice(4, 6)}-${TOURNAMENT_START.slice(6, 8)} ~ ${endLabel}`,
    matches,
    liveCount,
    finishedCount,
    scheduledCount,
    totalCount: matches.length,
  }
}

/** @deprecated 使用 fetchTournamentScoreboard */
export async function fetchRecentScoreboard(): Promise<LiveScoreboard> {
  return fetchTournamentScoreboard()
}
