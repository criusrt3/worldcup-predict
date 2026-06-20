import { callLlmChat, validateApiSettings } from './lib/chat-api-client'
import { buildMatchSituationContext, buildTournamentContext } from './groupStandings'
import { cleanAnalysisText } from './skillEngine'
import { normalizeMarkets } from './markets'
import type { ApiSettings, MatchStage, PredictionResult, TeamInfo } from './types'
import { localPredict } from './skillEngine'
import { loadSkill } from './skillLoader'
import type { LiveScoreboard } from './liveScore'

function parseJson(content: string, teamA: TeamInfo, teamB: TeamInfo): PredictionResult {
  const trimmed = content.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('模型未返回有效 JSON')
  const parsed = JSON.parse(jsonMatch[0]) as PredictionResult
  if (!parsed.teamA?.winProb || parsed.draw == null || !parsed.teamB?.winProb) {
    throw new Error('JSON 字段不完整')
  }
  parsed.markets = normalizeMarkets(parsed.markets, parsed, teamA, teamB)
  parsed.analysis = cleanAnalysisText(parsed.analysis)
  return parsed
}

export async function predictMatch(
  teamA: TeamInfo,
  teamB: TeamInfo,
  stage: MatchStage,
  settings: ApiSettings,
  liveBoard: LiveScoreboard | null = null,
): Promise<PredictionResult> {
  if (settings.demoMode || !settings.apiKey.trim()) {
    return localPredict(teamA, teamB, stage, liveBoard)
  }

  const keyError = validateApiSettings(settings)
  if (keyError) throw new Error(keyError)

  const ctx = buildTournamentContext(liveBoard)
  const situation = buildMatchSituationContext(ctx, teamA.name, teamB.name, stage)
  const skill = await loadSkill()
  const userPrompt = `请预测这场 2026 世界杯比赛:【${stage}】${teamA.name} vs ${teamB.name}。

${situation}

严格按约束文档的 JSON 格式输出（含 markets 盘口字段），并在 keyFactors 与 analysis 中体现上述出线/晋级压力。不要输出 JSON 以外的任何文字。`

  const content = await callLlmChat(
    settings,
    [
      { role: 'system', content: skill },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.75, responseFormat: 'json_object' },
  )

  return parseJson(content, teamA, teamB)
}
