import type { PredictionMarkets, PredictionResult, TeamInfo } from './types'

export const MARKET_GLOSSARY = {
  upset:
    '弱队击败强队，或与明显热门逼平的综合概率。数值越高，越可能出现「以弱胜强」的冷门赛果。',
  fullTimeResult:
    '全场 90 分钟（含伤停补时）结束时的比赛结果：主胜、平局或客胜，不含加时与点球。',
  halfTimeResult: '上半场 45 分钟（含补时）结束时的领先、平局或落后情况，常用于判断开局节奏。',
  handicap:
    '让球盘口：强队需净胜更多球才算「赢盘」。例如「主 -1」表示主队需净胜 2 球及以上才赢盘。',
  totalGoals: '全场比赛双方合计进球数区间预测，如「2-3 球」表示总进球大概率落在此范围。',
  bothTeamsScore: '预测双方是否都能在常规时间内至少攻入 1 球（Yes/No，即 BTTS）。',
  exactScore: '预测比赛最终精确比分（如 2-1）。命中难度最高，但最能体现模型对比赛走势的判断。',
} as const

export type MarketGlossaryKey = keyof typeof MARKET_GLOSSARY


function parseScoreParts(score: string): [number, number] {
  const m = score.match(/(\d+)\s*[-:：]\s*(\d+)/)
  if (!m) return [1, 1]
  return [Number.parseInt(m[1], 10) || 0, Number.parseInt(m[2], 10) || 0]
}

function pickWdl(winA: number, draw: number, winB: number): PredictionMarkets['fullTimeResult'] {
  if (winA >= winB && winA >= draw) return '主胜'
  if (winB >= winA && winB >= draw) return '客胜'
  return '平局'
}

export function deriveMarkets(
  result: Pick<PredictionResult, 'teamA' | 'teamB' | 'draw' | 'predictedScore'>,
  teamA: TeamInfo,
  teamB: TeamInfo,
): PredictionMarkets {
  const winA = result.teamA.winProb
  const winB = result.teamB.winProb
  const draw = result.draw
  const [gA, gB] = parseScoreParts(result.predictedScore)
  const tierDiff = Math.abs(teamA.tier - teamB.tier)
  const underdogWin = Math.min(winA, winB)
  const upsetProb = Math.min(
    88,
    Math.round(underdogWin + draw * 0.32 + (tierDiff >= 2 ? 10 : tierDiff === 1 ? 5 : 0)),
  )

  const fullTimeResult = pickWdl(winA, draw, winB)
  const fullTimeResultProb = fullTimeResult === '主胜' ? winA : fullTimeResult === '客胜' ? winB : draw

  const htDraw = Math.min(58, Math.round(draw + 14))
  const htHome = Math.round(winA * 0.62)
  const htAway = Math.max(0, 100 - htDraw - htHome)
  const halfTimeResult =
    htHome >= htDraw && htHome >= htAway ? '主胜' : htAway >= htDraw ? '客胜' : '平局'
  const halfTimeResultProb =
    halfTimeResult === '主胜' ? htHome : halfTimeResult === '客胜' ? htAway : htDraw

  const favHome = winA >= winB
  const favProb = Math.max(winA, winB)
  let handicap = '平手'
  let handicapPick: string = fullTimeResult
  if (favProb >= 52 && tierDiff >= 1) {
    handicap = favHome ? '主 -1' : '客 -1'
    handicapPick = favProb >= 62 ? (favHome ? '主胜' : '客胜') : '走盘'
  } else if (tierDiff >= 2) {
    handicap = favHome ? '客 +1' : '主 +1'
    handicapPick = underdogWin >= 38 ? (favHome ? '客胜' : '主胜') : favHome ? '主胜' : '客胜'
  }

  const total = gA + gB
  const totalGoals =
    total <= 1 ? '0-1 球' : total === 2 ? '2 球' : total <= 3 ? '2-3 球' : '4 球及以上'

  const bothYes = gA > 0 && gB > 0
  const bothTeamsScore: PredictionMarkets['bothTeamsScore'] =
    bothYes || (tierDiff <= 1 && Math.max(gA, gB) >= 1) ? '是' : '否'
  const bothTeamsScoreProb = bothYes
    ? Math.min(78, 52 + tierDiff * -4 + Math.min(gA, gB) * 8)
    : Math.max(22, 48 - tierDiff * 6)

  return {
    upsetProb,
    fullTimeResult,
    fullTimeResultProb,
    halfTimeResult,
    halfTimeResultProb,
    handicap,
    handicapPick,
    totalGoals,
    bothTeamsScore,
    bothTeamsScoreProb,
    exactScore: result.predictedScore.replace(':', '-'),
  }
}

export function normalizeMarkets(
  raw: Partial<PredictionMarkets> | undefined,
  result: Pick<PredictionResult, 'teamA' | 'teamB' | 'draw' | 'predictedScore'>,
  teamA: TeamInfo,
  teamB: TeamInfo,
): PredictionMarkets {
  const base = deriveMarkets(result, teamA, teamB)
  if (!raw) return base

  const wdl = (v: unknown, fallback: PredictionMarkets['fullTimeResult']) => {
    if (v === '主胜' || v === '平局' || v === '客胜') return v
    return fallback
  }

  return {
    upsetProb: clampPct(raw.upsetProb, base.upsetProb),
    fullTimeResult: wdl(raw.fullTimeResult, base.fullTimeResult),
    fullTimeResultProb: clampPct(raw.fullTimeResultProb, base.fullTimeResultProb),
    halfTimeResult: wdl(raw.halfTimeResult, base.halfTimeResult),
    halfTimeResultProb: clampPct(raw.halfTimeResultProb, base.halfTimeResultProb),
    handicap: str(raw.handicap, base.handicap),
    handicapPick: str(raw.handicapPick, base.handicapPick),
    totalGoals: str(raw.totalGoals, base.totalGoals),
    bothTeamsScore: raw.bothTeamsScore === '否' ? '否' : raw.bothTeamsScore === '是' ? '是' : base.bothTeamsScore,
    bothTeamsScoreProb: clampPct(raw.bothTeamsScoreProb, base.bothTeamsScoreProb),
    exactScore: str(raw.exactScore, base.exactScore),
  }
}

function clampPct(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''))
  if (Number.isNaN(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

function str(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || fallback
}
