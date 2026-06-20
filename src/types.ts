export type MatchStage =
  | '小组赛'
  | '32强'
  | '16强'
  | '8强'
  | '半决赛'
  | '决赛'

export type Confidence = '高' | '中' | '低'

export interface PlayerWatch {
  team: string
  player: string
  reason: string
}

export interface PredictionMarkets {
  /** 爆冷可能性 0-100：弱队赢球或逼平的综合概率 */
  upsetProb: number
  fullTimeResult: '主胜' | '平局' | '客胜'
  fullTimeResultProb: number
  halfTimeResult: '主胜' | '平局' | '客胜'
  halfTimeResultProb: number
  handicap: string
  handicapPick: string
  totalGoals: string
  bothTeamsScore: '是' | '否'
  bothTeamsScoreProb: number
  exactScore: string
}

export interface PredictionResult {
  teamA: { name: string; winProb: number }
  draw: number
  teamB: { name: string; winProb: number }
  predictedScore: string
  confidence: Confidence
  keyFactors: string[]
  analysis: string
  playersToWatch: PlayerWatch[]
  markets?: PredictionMarkets
}

export interface TeamInfo {
  name: string
  flag: string
  tier: 1 | 2 | 3 | 4
  color: string
}

export interface GroupInfo {
  id: string
  teams: TeamInfo[]
}

export interface ApiSettings {
  apiKey: string
  baseUrl: string
  model: string
  demoMode: boolean
  /** @deprecated 已统一走 /api/chat 服务端代理 */
  useProxy?: boolean
}

export interface HistoryEntry {
  id: string
  time: string
  stage: MatchStage
  teamA: string
  teamB: string
  result: PredictionResult
}

export type AppTheme = 'night' | 'day'

export type LiveFilter = 'all' | 'live' | 'finished' | 'scheduled'

/** 实时世界杯主视图：今日 / 全部赛程 / 积分榜 */
export type LiveSectionTab = 'today' | 'schedule' | 'standings'

export type AppView = 'predict' | 'chat' | 'live'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
  time?: string
}

export interface AppState {
  view: AppView
  activeGroup: string
  teamA: TeamInfo | null
  teamB: TeamInfo | null
  stage: MatchStage
  loading: boolean
  error: string | null
  result: PredictionResult | null
  settingsOpen: boolean
  historyOpen: boolean
}

export const STAGES: MatchStage[] = ['小组赛', '32强', '16强', '8强', '半决赛', '决赛']

export const DEFAULT_SETTINGS: ApiSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  demoMode: true,
}
