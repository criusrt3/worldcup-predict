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

export interface PredictionResult {
  teamA: { name: string; winProb: number }
  draw: number
  teamB: { name: string; winProb: number }
  predictedScore: string
  confidence: Confidence
  keyFactors: string[]
  analysis: string
  playersToWatch: PlayerWatch[]
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
  useProxy: boolean
  demoMode: boolean
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
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  useProxy: true,
  demoMode: true,
}
