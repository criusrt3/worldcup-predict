interface JsonTeamSide {
  name?: string
  winProb?: number
}

interface JsonMatchPrediction {
  teamA?: JsonTeamSide
  teamB?: JsonTeamSide
  draw?: number
  predictedScore?: string
  confidence?: string
  analysis?: string
  keyFactors?: string[]
}

function formatOneMatch(m: JsonMatchPrediction, index?: number): string {
  const a = m.teamA?.name ?? '主队'
  const b = m.teamB?.name ?? '客队'
  const winA = m.teamA?.winProb
  const winB = m.teamB?.winProb
  const draw = m.draw
  const head = index != null ? `**${index + 1}. ${a} vs ${b}**` : `**${a} vs ${b}**`

  const lines = [head]
  if (winA != null && winB != null && draw != null) {
    lines.push(`- 胜平负：${a} ${winA}% · 平 ${draw}% · ${b} ${winB}%`)
  }
  if (m.predictedScore) lines.push(`- 参考比分：**${m.predictedScore}**`)
  if (m.confidence) lines.push(`- 置信：${m.confidence}`)
  if (m.analysis) lines.push(`- 简评：${m.analysis}`)
  if (m.keyFactors?.length) {
    lines.push(`- 要点：${m.keyFactors.slice(0, 3).join('；')}`)
  }
  return lines.join('\n')
}

function tryFormatPredictionObject(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null

  const record = obj as Record<string, unknown>
  if (Array.isArray(record.matches)) {
    const blocks = record.matches
      .filter((m): m is JsonMatchPrediction => !!m && typeof m === 'object')
      .map((m, i) => formatOneMatch(m, i))
    return blocks.length ? blocks.join('\n\n') : null
  }

  if (record.teamA && record.teamB) {
    return formatOneMatch(record as JsonMatchPrediction)
  }

  return null
}

/** 若模型误返回 JSON，转成可读中文；否则原样返回 */
export function normalizeChatReply(raw: string): string {
  let text = raw.trim()
  if (!text) return text

  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fenced) text = fenced[1].trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown
      const formatted = tryFormatPredictionObject(parsed)
      if (formatted) return formatted
    } catch {
      /* 非 JSON，继续 */
    }
  }

  return raw.trim()
}
