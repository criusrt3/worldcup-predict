import { GROUPS, TIER_LABELS, findGroupByTeam, findTeam } from './data'
import {
  buildTournamentContext,
  situationPowerBonus,
  situationalDrawAdjust,
  type TeamStanding,
} from './groupStandings'
import { loadSkill } from './skillLoader'
import {
  filterTodayMatches,
  formatBeijingDateTime,
  formatKickoffBeijing,
  sortTodayMatches,
  type LiveMatch,
  type LiveScoreboard,
} from './liveScore'
import { deriveMarkets } from './markets'
import type { MatchStage, PredictionResult, TeamInfo } from './types'

export interface TeamProfile {
  name: string
  group: string
  section: string
  summary: string
}

let profilesCache: Map<string, TeamProfile> | null = null
let intelCache: string[] = []

const HOSTS = new Set(['墨西哥', '美国', '加拿大'])

/** 取资料库摘要首句，并避免在括号中间截断 */
export function clipSummaryClause(text: string, maxLen = 36): string {
  let s = (text.split(/[。；\n]/)[0] ?? text).trim()
  if (s.length > maxLen) {
    s = s.slice(0, maxLen)
    s = s.replace(/（[^）]*$/u, '').replace(/\([^)]*$/u, '').trim()
  }
  return s
}

/** 清理战术解读里多余或截断的括号 */
export function cleanAnalysisText(text: string): string {
  let s = text.trim()
  s = s.replace(/^（[^）]{0,18}）\s*/u, '')
  s = s.replace(/（[^）]*$/u, '').replace(/\([^)]*$/u, '').trim()
  return s
}

const NAME_ALIASES: Record<string, string> = {
  刚果金: '刚果金',
  '刚果(金)': '刚果金',
  民主刚果: '刚果金',
}

function normName(name: string): string {
  return NAME_ALIASES[name] ?? name
}

export function parseSkillProfiles(skill: string): Map<string, TeamProfile> {
  const map = new Map<string, TeamProfile>()
  let section = '资料库'
  for (const line of skill.split('\n')) {
    const head = line.match(/^###\s+(.+)/)
    if (head) {
      section = head[1].trim()
      continue
    }
    const m = line.match(/\*\*([^*]+)\*\*（([A-L])组）：(.+)/)
    if (!m) continue
    const name = normName(m[1].trim())
    map.set(name, {
      name,
      group: m[2],
      section,
      summary: m[3].trim(),
    })
  }
  return map
}

function parseIntel(skill: string): string[] {
  const block = skill.match(/## 六、最新情报[\s\S]*?(?=## |$)/)
  if (!block) return []
  return block[0]
    .split('\n')
    .map((l) => l.replace(/^[-*>]\s*/, '').trim())
    .filter((l) => l && !l.startsWith('本节') && !l.startsWith('**情报日期'))
}

async function ensureKnowledge() {
  if (profilesCache) return
  const skill = await loadSkill()
  profilesCache = parseSkillProfiles(skill)
  intelCache = parseIntel(skill)
}

export async function getTeamProfile(name: string): Promise<TeamProfile | null> {
  await ensureKnowledge()
  return profilesCache!.get(normName(name)) ?? null
}

export async function getAllProfiles(): Promise<TeamProfile[]> {
  await ensureKnowledge()
  return [...profilesCache!.values()]
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function tierStrength(tier: TeamInfo['tier']) {
  return { 1: 88, 2: 74, 3: 58, 4: 44 }[tier]
}

function recentFormScore(profile: TeamProfile | null, tier: TeamInfo['tier']): number {
  let score = tierStrength(tier)
  if (!profile) return score
  const t = profile.summary
  if (/冠军|欧洲杯冠军|美洲杯冠军|头名|强势|热门|不败|回升|亚军/.test(t)) score += 8
  if (/预选赛.*(碾压|极其|零失球|火力)/.test(t)) score += 6
  if (/隐忧|老化|重伤|动荡|魔咒|重建|零经验|待观察|整体性差|上限有限/.test(t)) score -= 7
  if (/首次|历史首次|新军|励志|人口最少/.test(t)) score -= 4
  return clamp(score, 35, 95)
}

function contextScore(
  team: TeamInfo,
  stage: MatchStage,
  profile: TeamProfile | null,
  standing?: TeamStanding,
): number {
  let score = 52
  if (HOSTS.has(team.name)) score += 14
  if (stage !== '小组赛' && team.tier <= 2) score += 10
  if (profile?.summary.includes('大赛') && team.tier <= 2) score += 4
  if (standing) score += situationPowerBonus(standing.qualStatus)
  return clamp(score, 40, 92)
}

function composeStrength(profile: TeamProfile | null, tier: TeamInfo['tier']): number {
  return profile ? clamp(tierStrength(tier) + (profile.section.includes('热门') ? 4 : 0), 40, 92) : tierStrength(tier)
}

function teamPower(
  team: TeamInfo,
  profile: TeamProfile | null,
  stage: MatchStage,
  standing?: TeamStanding,
): number {
  const recent = recentFormScore(profile, team.tier)
  const strength = composeStrength(profile, team.tier)
  const h2h = 50
  const context = contextScore(team, stage, profile, standing)
  return recent * 0.4 + strength * 0.3 + h2h * 0.15 + context * 0.15
}

function pickScore(powerA: number, powerB: number, stage: MatchStage): string {
  const diff = powerA - powerB
  if (stage !== '小组赛' && Math.abs(diff) < 10) return '1-1'
  if (diff > 26) return `${clamp(2 + (diff > 32 ? 1 : 0), 2, 3)}-0`
  if (diff > 12) return `${clamp(1 + (diff > 18 ? 1 : 0), 1, 2)}-0`
  if (diff > 4) return '2-1'
  if (diff > -4) return stage === '小组赛' ? '1-1' : '0-0'
  if (diff > -12) return '1-2'
  return `0-${clamp(1 + (diff < -18 ? 1 : 0), 1, 2)}`
}

function normalizeProbs(
  winA: number,
  winB: number,
  stage: MatchStage,
  stA?: TeamStanding,
  stB?: TeamStanding,
): [number, number, number] {
  const drawBase = clamp((stage === '小组赛' ? 26 : 14) + situationalDrawAdjust(stage, stA, stB), 8, 32)
  const total = winA + winB + drawBase
  let a = Math.round((winA / total) * 100)
  let d = Math.round((drawBase / total) * 100)
  let b = 100 - a - d
  a = clamp(a, 5, 85)
  b = clamp(b, 5, 85)
  d = clamp(100 - a - b, stage === '小组赛' ? 8 : 5, 35)
  b = 100 - a - d
  return [a, d, b]
}

function extractPlayer(summary: string, teamName: string): { player: string; reason: string } {
  const aged = summary.match(/([^、，。（]+?)（\d+岁[^，。]*?）/)
  if (aged) {
    const player = aged[1].trim()
    const concern = summary.match(/隐忧：([^。]+)/)?.[1]
    return {
      player,
      reason: concern ? concern.slice(0, 22) : '战术核心，决定进攻上限',
    }
  }
  const first = summary.match(/([^\s，。（]+(?:·[^\s，。（]+)?)、/)
  if (first) {
    return { player: first[1].replace(/、$/, ''), reason: `${teamName}关键球员` }
  }
  return { player: `${teamName}核心`, reason: '本地资料库未标注具体球星' }
}

function buildKeyFactors(
  teamA: TeamInfo,
  teamB: TeamInfo,
  pA: TeamProfile | null,
  pB: TeamProfile | null,
  stage: MatchStage,
  leader: TeamInfo,
  stA?: TeamStanding,
  stB?: TeamStanding,
): string[] {
  const factors: string[] = []
  if (stA?.qualLabel && stB?.qualLabel && stage === '小组赛' && stA.groupId === stB.groupId) {
    factors.push(`${teamA.name} ${stA.qualLabel}：${stA.qualHint}`)
    factors.push(`${teamB.name} ${stB.qualLabel}：${stB.qualHint}`)
  } else if (pA && pB) {
    factors.push(`${teamA.name}：${clipSummaryClause(pA.summary, 42)}`)
    factors.push(`${teamB.name}：${clipSummaryClause(pB.summary, 42)}`)
  } else {
    factors.push(`${TIER_LABELS[teamA.tier]} vs ${TIER_LABELS[teamB.tier]}`)
  }
  if (stage === '小组赛') {
    const hot = [stA, stB].some((s) => s?.qualStatus === 'desperate' || s?.qualStatus === 'must_win')
    factors.push(hot ? '出线压力下平局概率下调，抢分意愿更强' : '小组赛平局权重需结合出线形势')
  } else factors.push('淘汰赛平局指90分钟')
  if (HOSTS.has(leader.name)) factors.push('东道主情境加成')
  else if (leader.tier <= 2) factors.push('大赛经验与阵容厚度')
  else factors.push('冷门空间仍不可忽视')
  return factors.slice(0, 5)
}

function buildAnalysis(
  teamA: TeamInfo,
  teamB: TeamInfo,
  pA: TeamProfile | null,
  pB: TeamProfile | null,
  stage: MatchStage,
  leader: TeamInfo,
  winA: number,
  winB: number,
  stA?: TeamStanding,
  stB?: TeamStanding,
): string {
  const leadProb = leader.name === teamA.name ? winA : winB
  const lp = leader.name === teamA.name ? pA : pB
  const tp = leader.name === teamA.name ? pB : pA
  const leadHint = clipSummaryClause(lp?.summary ?? TIER_LABELS[leader.tier])
  const trailName = leader.name === teamA.name ? teamB.name : teamA.name
  const trailHint = clipSummaryClause(
    tp?.summary ?? `${TIER_LABELS[leader.name === teamA.name ? teamB.tier : teamA.tier]}成色`,
  )
  let stageNote =
    stage === '小组赛'
      ? '小组赛拿分压力与平局选项都要纳入。'
      : '淘汰赛节奏更保守，平局后加时点球需看大赛经验。'
  if (stage === '小组赛' && stA && stB && stA.groupId === stB.groupId) {
    const bits = [stA.qualHint, stB.qualHint].filter(Boolean)
    if (bits.length) stageNote = bits.join(' ')
  }
  return cleanAnalysisText(
    `【本地神算·Skill资料库】${stage} ${teamA.name} vs ${teamB.name}：${leadHint}；${trailName}方面${trailHint}。综合近期状态（40%）、硬实力（30%）、交锋（15%）与情境（15%），略倾向 ${leader.name}（约 ${leadProb}%）。${stageNote}仅供球迷讨论，非投注建议。`,
  )
}

export async function localPredict(
  teamA: TeamInfo,
  teamB: TeamInfo,
  stage: MatchStage,
  liveBoard: LiveScoreboard | null = null,
): Promise<PredictionResult> {
  await ensureKnowledge()
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 400))

  const ctx = buildTournamentContext(liveBoard)
  const stA = ctx.byTeam.get(teamA.name)
  const stB = ctx.byTeam.get(teamB.name)
  const pA = profilesCache!.get(teamA.name) ?? null
  const pB = profilesCache!.get(teamB.name) ?? null
  const wA = teamPower(teamA, pA, stage, stA)
  const wB = teamPower(teamB, pB, stage, stB)
  const [winA, draw, winB] = normalizeProbs(wA, wB, stage, stA, stB)
  const leader = winA >= winB ? teamA : teamB

  const result: PredictionResult = {
    teamA: { name: teamA.name, winProb: winA },
    draw,
    teamB: { name: teamB.name, winProb: winB },
    predictedScore: pickScore(wA, wB, stage),
    confidence: Math.abs(winA - winB) > 22 ? '高' : Math.abs(winA - winB) > 10 ? '中' : '低',
    keyFactors: buildKeyFactors(teamA, teamB, pA, pB, stage, leader, stA, stB),
    analysis: buildAnalysis(teamA, teamB, pA, pB, stage, leader, winA, winB, stA, stB),
    playersToWatch: [
      { team: teamA.name, ...extractPlayer(pA?.summary ?? '', teamA.name) },
      { team: teamB.name, ...extractPlayer(pB?.summary ?? '', teamB.name) },
    ],
  }
  result.markets = deriveMarkets(result, teamA, teamB)
  return result
}

function findTeamsInText(text: string): TeamInfo[] {
  const found: TeamInfo[] = []
  for (const g of GROUPS) {
    for (const t of g.teams) {
      if (text.includes(t.name)) found.push(t)
    }
  }
  return found
}

function formatLiveMatch(m: LiveMatch): string {
  const score = `${m.home.name} ${m.home.score}:${m.away.score} ${m.away.name}`
  const time =
    m.status === 'scheduled'
      ? formatKickoffBeijing(m.startTimeIso)
      : m.isLive
        ? `${formatBeijingDateTime(m.startTimeIso)} · ${m.clock}`
        : `${formatBeijingDateTime(m.startTimeIso)} · 完场`
  return `· ${m.stageLabel} | ${score}（${time}）`
}

function groupSummary(groupId: string): string {
  const g = GROUPS.find((x) => x.id === groupId)
  if (!g) return `未找到 ${groupId} 组`
  const lines = g.teams.map((t) => {
    const p = profilesCache?.get(t.name)
    const brief = p ? p.summary.split('。')[0] : TIER_LABELS[t.tier]
    return `- **${t.name}**（${TIER_LABELS[t.tier]}）：${brief}`
  })
  return `**${groupId} 组**（Skill 资料库）\n${lines.join('\n')}`
}

function teamBrief(name: string): string {
  const team = findTeam(name)
  const p = profilesCache?.get(name)
  if (!p && !team) return `资料库暂无「${name}」`
  const group = findGroupByTeam(name) ?? p?.group ?? '?'
  const body = p?.summary ?? `${TIER_LABELS[team!.tier]}，详见分组表。`
  return `**${name}**（${group} 组 · ${p?.section ?? TIER_LABELS[team!.tier]}）\n${body}`
}

export async function localChatReply(question: string, board: LiveScoreboard | null): Promise<string> {
  await ensureKnowledge()
  const q = question.trim()

  const groupM = q.match(/([A-La-l])组/)
  if (groupM) {
    return groupSummary(groupM[1].toUpperCase())
  }

  if (/今天|今晚|今日|赛程|有哪些比赛|几点/.test(q)) {
    if (!board?.matches.length) {
      return '赛况尚未加载，请先打开「2026 实时世界杯」Tab 刷新。'
    }
    const today = sortTodayMatches(filterTodayMatches(board.matches))
    if (!today.length) {
      return `今日（北京时间）暂无赛程。最新情报：\n${intelCache.map((l) => `· ${l}`).join('\n') || '见 Skill 第六节'}`
    }
    const lines = today.map((m) => formatLiveMatch(m))
    return `**今日赛程（北京时间）** 共 ${today.length} 场：\n${lines.join('\n')}`
  }

  if (/实时|比分|赛果|完场|进行中/.test(q)) {
    const live = board?.matches.filter((m) => m.isLive) ?? []
    const finished = board?.matches.filter((m) => m.status === 'finished').slice(0, 8) ?? []
    if (live.length) {
      return `**进行中 ${live.length} 场：**\n${live.map(formatLiveMatch).join('\n')}`
    }
    if (finished.length) {
      return `**近期完场：**\n${finished.map(formatLiveMatch).join('\n')}\n\n共 ${board?.finishedCount ?? 0} 场已完赛。`
    }
    return '当前无进行中比赛。可切到赛况 Tab 查看「未开始」或「今日赛程」。'
  }

  const teams = findTeamsInText(q)
  if (teams.length >= 2 && /预测|谁会赢|胜平负|分析|怎么样|谁能/.test(q)) {
    const [a, b] = teams
    const r = await localPredict(a, b, '小组赛', board)
    return `**${a.name} vs ${b.name}**（本地 Skill 分析）\n\n${r.analysis}\n\n胜平负：${a.name} ${r.teamA.winProb}% · 平 ${r.draw}% · ${b.name} ${r.teamB.winProb}%\n预测比分：**${r.predictedScore}** · 置信 ${r.confidence}`
  }

  if (teams.length === 1) {
    const name = teams[0].name
    let extra = teamBrief(name)
    const related =
      board?.matches.filter((m) => m.home.name === name || m.away.name === name).slice(0, 3) ?? []
    if (related.length) {
      extra += `\n\n**相关赛况：**\n${related.map(formatLiveMatch).join('\n')}`
    }
    return extra
  }

  if (/情报|开幕|揭幕/.test(q)) {
    return `**最新情报（Skill 第六节）**\n${intelCache.map((l) => `· ${l}`).join('\n') || '暂无'}`
  }

  if (/分组|48队|出线|规则/.test(q)) {
    const intro =
      '48 队 12 组，每组前两名 + 8 个最佳第三名进 32 强。美/加/墨三东道主。'
    const groups = GROUPS.map((g) => `${g.id}组：${g.teams.map((t) => t.name).join('、')}`).join('\n')
    return `${intro}\n\n${groups}`
  }

  if (/预测台|怎么用/.test(q)) {
    return '结构化 JSON 预测请用「预测台」选两队后点「开始预测」。本地模式已读取 skill.md 资料库做规则分析；接入 API 后可切换大模型深度推理。'
  }

  const upcoming = board ? sortTodayMatches(filterTodayMatches(board.matches)).find((m) => m.status === 'scheduled') : null
  const hint = upcoming
    ? `下一场：${upcoming.home.name} vs ${upcoming.away.name}（${formatKickoffBeijing(upcoming.startTimeIso)}）`
    : '可问具体球队、某组形势、今日赛程或「阿根廷 vs 法国 谁会赢」'

  return `【本地神算】已加载 Skill 资料库（${profilesCache!.size} 队）。${hint}\n\n${intelCache[0] ? `最新：${intelCache[0]}` : ''}`
}
