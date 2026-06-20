import { GROUPS } from './data'
import type { LiveMatch, LiveScoreboard } from './liveScore'
import type { MatchStage } from './types'

export type QualStatus =
  | 'qualified'
  | 'knockout_in'
  | 'knockout_out'
  | 'likely'
  | 'contending'
  | 'must_win'
  | 'desperate'
  | 'eliminated'
  | 'third_watch'
  | 'pending'

export const QUAL_LABELS: Record<QualStatus, string> = {
  qualified: '已晋级',
  knockout_in: '晋级',
  knockout_out: '出局',
  likely: '出线有利',
  contending: '出线争夺',
  must_win: '必须抢分',
  desperate: '生死战',
  eliminated: '已出局',
  third_watch: '争最佳第三',
  pending: '',
}

export const QUAL_CLASS: Record<QualStatus, string> = {
  qualified: 'qual--in',
  knockout_in: 'qual--in',
  knockout_out: 'qual--out',
  likely: 'qual--good',
  contending: 'qual--mid',
  must_win: 'qual--hot',
  desperate: 'qual--hot',
  eliminated: 'qual--out',
  third_watch: 'qual--third',
  pending: '',
}

export interface TeamStanding {
  name: string
  groupId: string
  played: number
  win: number
  draw: number
  loss: number
  gf: number
  ga: number
  gd: number
  pts: number
  rank: number
  qualStatus: QualStatus
  qualLabel: string
  qualHint: string
}

export interface GroupStandings {
  groupId: string
  displayId: string
  teams: TeamStanding[]
  finishedMatches: number
  totalMatches: number
}

export interface TournamentContext {
  groups: GroupStandings[]
  byTeam: Map<string, TeamStanding>
  knockoutAdvancers: Set<string>
  knockoutEliminated: Set<string>
  hasGroupResults: boolean
  hasKnockoutResults: boolean
}

function initStanding(name: string, groupId: string): TeamStanding {
  return {
    name,
    groupId,
    played: 0,
    win: 0,
    draw: 0,
    loss: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
    rank: 0,
    qualStatus: 'pending',
    qualLabel: '',
    qualHint: '',
  }
}

function recordResult(
  byTeam: Map<string, TeamStanding>,
  home: string,
  away: string,
  hs: number,
  as: number,
) {
  const h = byTeam.get(home)
  const a = byTeam.get(away)
  if (!h || !a) return

  h.played += 1
  a.played += 1
  h.gf += hs
  h.ga += as
  a.gf += as
  a.ga += hs

  if (hs > as) {
    h.win += 1
    a.loss += 1
    h.pts += 3
  } else if (hs < as) {
    a.win += 1
    h.loss += 1
    a.pts += 3
  } else {
    h.draw += 1
    a.draw += 1
    h.pts += 1
    a.pts += 1
  }

  h.gd = h.gf - h.ga
  a.gd = a.gf - a.ga
}

function rankGroup(teams: TeamStanding[]) {
  teams.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name, 'zh'))
  teams.forEach((t, i) => {
    t.rank = i + 1
  })
}

function computeQualStatus(team: TeamStanding, sorted: TeamStanding[], groupComplete: boolean, remaining: number) {
  if (groupComplete) {
    if (team.rank <= 2) {
      team.qualStatus = 'qualified'
      team.qualLabel = '已晋级'
      team.qualHint = `小组第 ${team.rank}，挺进 32 强`
      return
    }
    if (team.rank === 3) {
      team.qualStatus = 'third_watch'
      team.qualLabel = '争最佳第三'
      team.qualHint = `${team.pts} 分 · 净胜球 ${team.gd >= 0 ? '+' : ''}${team.gd}，与其他组第三名比较`
      return
    }
    team.qualStatus = 'eliminated'
    team.qualLabel = '已出局'
    team.qualHint = '小组垫底，告别本届世界杯'
    return
  }

  const leaderPts = sorted[0]?.pts ?? 0
  const secondPts = sorted[1]?.pts ?? 0
  const maxPts = team.pts + remaining * 3

  if (maxPts < secondPts && remaining <= 1 && team.rank >= 3) {
    team.qualStatus = 'eliminated'
    team.qualLabel = '已出局'
    team.qualHint = '积分已无法追及出线区，理论出局'
    return
  }

  if (team.loss >= 2 && team.played >= 2 && remaining === 1) {
    if (team.pts === 0) {
      team.qualStatus = 'desperate'
      team.qualLabel = '生死战'
      team.qualHint = '两连败后此役再负即出局，必须全力争胜'
      return
    }
    if (team.pts <= 1) {
      team.qualStatus = 'must_win'
      team.qualLabel = '必须抢分'
      team.qualHint = '仅剩一场，亟需胜利否则出线希望渺茫'
      return
    }
  }

  if (team.pts >= 6 && team.rank <= 2) {
    team.qualStatus = 'likely'
    team.qualLabel = '出线有利'
    team.qualHint = `${team.pts} 分领跑，再赢即可锁定晋级`
    return
  }

  if (team.pts >= 4 && team.rank <= 2 && remaining >= 1) {
    team.qualStatus = 'likely'
    team.qualLabel = '出线有利'
    team.qualHint = `积 ${team.pts} 分，赢球可巩固出线形势`
    return
  }

  if (team.pts === 3 && remaining >= 1 && team.rank <= 3) {
    team.qualStatus = 'must_win'
    team.qualLabel = '必须抢分'
    team.qualHint = '赢球可积 4 分争取主动，平局恐将出线悬念拖至末轮'
    return
  }

  if (team.pts === 0 && team.played >= 1 && team.loss >= 1) {
    team.qualStatus = 'contending'
    team.qualLabel = '出线争夺'
    team.qualHint = '开局失利，后续每场都是关键战，输球压力陡增'
    return
  }

  if (team.rank === 1 && team.pts >= leaderPts && team.pts >= 3 && remaining >= 1) {
    team.qualStatus = 'contending'
    team.qualLabel = '出线争夺'
    team.qualHint = `暂列第 ${team.rank}，但末轮仍有变数，需持续抢分`
    return
  }

  team.qualStatus = 'contending'
  team.qualLabel = '出线争夺'
  team.qualHint = `${team.pts} 分暂列第 ${team.rank}，每分都关乎出线`
}

export function nextKnockoutLabel(stage: string): string {
  const map: Record<string, string> = {
    '32强': '晋级 16 强',
    '16强': '晋级 8 强',
    '8强': '晋级 4 强',
    半决赛: '晋级决赛',
    决赛: '冠军',
    三四名决赛: '季军',
  }
  return map[stage] ?? '晋级'
}

export function buildTournamentContext(board: LiveScoreboard | null): TournamentContext {
  const byTeam = new Map<string, TeamStanding>()
  const groups: GroupStandings[] = []

  for (const g of GROUPS) {
    const teams = g.teams.map((t) => initStanding(t.name, g.id))
    groups.push({
      groupId: g.id,
      displayId: `${g.id} 组`,
      teams,
      finishedMatches: 0,
      totalMatches: 6,
    })
    teams.forEach((t) => byTeam.set(t.name, t))
  }

  const knockoutAdvancers = new Set<string>()
  const knockoutEliminated = new Set<string>()
  const groupFinished = new Map<string, number>()

  if (board) {
    for (const m of board.matches) {
      if (m.status !== 'finished') continue

      if (m.stage !== '小组赛') {
        if (m.home.winner) {
          knockoutAdvancers.add(m.home.name)
          knockoutEliminated.add(m.away.name)
        } else if (m.away.winner) {
          knockoutAdvancers.add(m.away.name)
          knockoutEliminated.add(m.home.name)
        }
        continue
      }

      const groupKey = m.group.replace(/\s*组\s*/u, '').trim()
      if (!groupKey) continue

      recordResult(byTeam, m.home.name, m.away.name, m.home.score, m.away.score)
      groupFinished.set(groupKey, (groupFinished.get(groupKey) ?? 0) + 1)
    }
  }

  for (const gs of groups) {
    rankGroup(gs.teams)
    gs.finishedMatches = groupFinished.get(gs.groupId) ?? 0
    const groupComplete = gs.finishedMatches >= gs.totalMatches
    for (const t of gs.teams) {
      computeQualStatus(t, gs.teams, groupComplete, 3 - t.played)
    }
  }

  return {
    groups,
    byTeam,
    knockoutAdvancers,
    knockoutEliminated,
    hasGroupResults: [...groupFinished.values()].some((n) => n > 0),
    hasKnockoutResults: knockoutAdvancers.size > 0,
  }
}

export function getTeamQualBadge(ctx: TournamentContext, teamName: string, match: LiveMatch): { label: string; cls: string; hint: string } | null {
  if (match.stage !== '小组赛') {
    if (match.status !== 'finished') return null
    if (ctx.knockoutAdvancers.has(teamName)) {
      return { label: nextKnockoutLabel(match.stage), cls: 'qual--in', hint: `${match.stage} 胜者` }
    }
    if (ctx.knockoutEliminated.has(teamName)) {
      return { label: '出局', cls: 'qual--out', hint: `${match.stage} 止步` }
    }
    return null
  }

  const st = ctx.byTeam.get(teamName)
  if (!st?.qualLabel) return null
  return { label: st.qualLabel, cls: QUAL_CLASS[st.qualStatus], hint: st.qualHint }
}

export function situationPowerBonus(status: QualStatus): number {
  switch (status) {
    case 'desperate':
      return 12
    case 'must_win':
      return 9
    case 'likely':
      return 4
    case 'contending':
      return 2
    case 'qualified':
      return -5
    case 'eliminated':
      return -10
    default:
      return 0
  }
}

export function situationalDrawAdjust(stage: MatchStage, stA?: TeamStanding, stB?: TeamStanding): number {
  if (stage !== '小组赛') return 0
  let adj = 0
  const hot = (s?: TeamStanding) => s?.qualStatus === 'desperate' || s?.qualStatus === 'must_win'
  if (hot(stA) && hot(stB)) adj -= 10
  else if (hot(stA) || hot(stB)) adj -= 6
  if (stA?.qualStatus === 'qualified' && stB?.qualStatus === 'qualified') adj += 5
  if (stA?.qualStatus === 'eliminated' || stB?.qualStatus === 'eliminated') adj -= 4
  return adj
}

export function buildMatchSituationContext(
  ctx: TournamentContext,
  teamA: string,
  teamB: string,
  stage: MatchStage,
): string {
  if (stage !== '小组赛') {
    const lines = [`【${stage}淘汰赛情境】`]
    if (ctx.knockoutAdvancers.has(teamA)) lines.push(`${teamA} 已从上一轮晋级`)
    if (ctx.knockoutAdvancers.has(teamB)) lines.push(`${teamB} 已从上一轮晋级`)
    lines.push('淘汰赛平局指 90 分钟战平后进入加时/点球，双方都会全力争胜')
    return lines.join('\n')
  }

  const stA = ctx.byTeam.get(teamA)
  const stB = ctx.byTeam.get(teamB)
  if (!stA || !stB || stA.groupId !== stB.groupId) {
    return '【小组赛出线形势】两队不同组或暂无积分榜数据，按常规则分析'
  }

  const gs = ctx.groups.find((g) => g.groupId === stA.groupId)
  const table = gs?.teams.map((t) => `${t.rank}. ${t.name} ${t.pts}分 (${t.played}场 ${t.win}胜${t.draw}平${t.loss}负 · ${t.gf}:${t.ga})`).join('；')

  return [
    `【${stA.groupId} 组出线形势】`,
    `积分榜：${table}`,
    `${teamA}：${stA.qualHint}`,
    `${teamB}：${stB.qualHint}`,
    '预测须结合抢分压力：连败球队往往更激进；领先球队可能控节奏；平局对急需 3 分的球队通常不可接受',
  ].join('\n')
}

export function buildStandingsSnapshot(ctx: TournamentContext): string {
  const active = ctx.groups.filter((g) => g.finishedMatches > 0)
  if (!active.length) return '【小组积分榜】暂无已完赛小组赛，按资料库分析'

  const lines = ['【小组积分榜与出线形势】']
  for (const g of active) {
    const rows = g.teams
      .map((t) => {
        const tag = t.qualLabel ? `[${t.qualLabel}]` : ''
        return `${t.rank}.${t.name} ${t.pts}分 ${t.gf}:${t.ga}${tag}`
      })
      .join(' | ')
    lines.push(`${g.displayId}（${g.finishedMatches}/${g.totalMatches}场）：${rows}`)
  }

  if (ctx.hasKnockoutResults) {
    lines.push(`【淘汰赛晋级】${[...ctx.knockoutAdvancers].slice(0, 16).join('、')}${ctx.knockoutAdvancers.size > 16 ? '…' : ''}`)
  }
  return lines.join('\n')
}
