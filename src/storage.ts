import type { ApiSettings, AppTheme, AppView, HistoryEntry, LiveFilter, LiveSectionTab, ChatMessage } from './types'
import type { StageFilter } from './liveScore'
import { DEFAULT_SETTINGS } from './types'

const SETTINGS_KEY = 'wc26-settings'
const HISTORY_KEY = 'wc26-history'
const THEME_KEY = 'wc26-theme'
const LIVE_FILTER_KEY = 'wc26-live-filter'
const LIVE_SECTION_TAB_KEY = 'wc26-live-section-tab'
const LIVE_STAGE_FILTER_KEY = 'wc26-live-stage-filter'
const VIEW_KEY = 'wc26-view'

export function loadSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as ApiSettings
    if (merged.baseUrl === 'https://api.deepseek.com') {
      merged.baseUrl = 'https://api.deepseek.com/v1'
    }
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: ApiSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function pushHistory(entry: HistoryEntry) {
  const list = loadHistory()
  list.unshift(entry)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function loadTheme(): AppTheme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'day' ? 'day' : 'night'
  } catch {
    return 'night'
  }
}

export function saveTheme(theme: AppTheme) {
  localStorage.setItem(THEME_KEY, theme)
}

export function loadLiveFilter(): LiveFilter {
  try {
    const raw = localStorage.getItem(LIVE_FILTER_KEY)
    if (raw === 'all' || raw === 'live' || raw === 'finished' || raw === 'scheduled') return raw
  } catch {
    /* ignore */
  }
  return 'all'
}

export function saveLiveFilter(filter: LiveFilter) {
  localStorage.setItem(LIVE_FILTER_KEY, filter)
}

export function loadLiveSectionTab(): LiveSectionTab {
  try {
    const raw = localStorage.getItem(LIVE_SECTION_TAB_KEY)
    if (raw === 'today' || raw === 'schedule' || raw === 'standings') return raw
  } catch {
    /* ignore */
  }
  return 'today'
}

export function saveLiveSectionTab(tab: LiveSectionTab) {
  localStorage.setItem(LIVE_SECTION_TAB_KEY, tab)
}

export function loadLiveStageFilter(): StageFilter {
  try {
    const raw = localStorage.getItem(LIVE_STAGE_FILTER_KEY)
    if (raw === 'all') return 'all'
    const stages = ['小组赛', '32强', '16强', '8强', '半决赛', '三四名决赛', '决赛']
    if (raw && stages.includes(raw)) return raw as StageFilter
  } catch {
    /* ignore */
  }
  return 'all'
}

export function saveLiveStageFilter(filter: StageFilter) {
  localStorage.setItem(LIVE_STAGE_FILTER_KEY, filter)
}

const CHAT_KEY = 'wc26-chat'

export function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveChatHistory(messages: ChatMessage[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-50)))
}

export function clearChatHistory() {
  localStorage.removeItem(CHAT_KEY)
}

export function loadView(): AppView {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw === 'chat' || raw === 'live' || raw === 'predict') return raw
  } catch {
    /* ignore */
  }
  return 'predict'
}

export function saveView(view: AppView) {
  localStorage.setItem(VIEW_KEY, view)
}
