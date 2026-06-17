import { createChatController, renderChatShell } from './chatPanel'
import { FEATURED_MATCHES, GROUPS, TIER_LABELS, findGroupByTeam, findTeam, groupFixtures } from './data'
import { createLiveController, renderLiveSectionShell } from './livePanel'
import { predictMatch } from './predict'
import { clearHistory, loadHistory, loadSettings, loadTheme, loadView, pushHistory, saveSettings, saveTheme, saveView } from './storage'
import type { AppState, AppTheme, AppView, HistoryEntry, MatchStage, PredictionResult, TeamInfo } from './types'
import { STAGES } from './types'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function confidenceClass(c: string) {
  if (c === '高') return 'conf-high'
  if (c === '中') return 'conf-mid'
  return 'conf-low'
}

function renderProbBar(label: string, value: number, color: string, align: 'left' | 'center' | 'right') {
  return `
    <div class="prob-row prob-${align}">
      <div class="prob-meta">
        <span class="prob-label">${escapeHtml(label)}</span>
        <span class="prob-value">${value}%</span>
      </div>
      <div class="prob-track">
        <div class="prob-fill" style="width:0%;--target:${value}%;--color:${color}"></div>
      </div>
    </div>
  `
}

function renderResult(result: PredictionResult, teamA: TeamInfo, teamB: TeamInfo) {
  const [sA, sB] = result.predictedScore.split('-')
  return `
    <section class="result-card reveal">
      <div class="result-header">
        <span class="result-badge ${confidenceClass(result.confidence)}">置信 · ${result.confidence}</span>
        <span class="result-tag">AI 分析完成</span>
      </div>

      <div class="scoreboard">
        <div class="score-team" style="--team-color:${teamA.color}">
          <span class="score-flag">${teamA.flag}</span>
          <span class="score-name">${escapeHtml(result.teamA.name)}</span>
        </div>
        <div class="score-center">
          <div class="score-digits">
            <span class="digit">${sA ?? '?'}</span>
            <span class="colon">:</span>
            <span class="digit">${sB ?? '?'}</span>
          </div>
          <p class="score-hint">预测比分</p>
        </div>
        <div class="score-team score-team-right" style="--team-color:${teamB.color}">
          <span class="score-flag">${teamB.flag}</span>
          <span class="score-name">${escapeHtml(result.teamB.name)}</span>
        </div>
      </div>

      <div class="prob-panel">
        ${renderProbBar(result.teamA.name, result.teamA.winProb, teamA.color, 'left')}
        ${renderProbBar('平局', result.draw, 'var(--draw-bar-color)', 'center')}
        ${renderProbBar(result.teamB.name, result.teamB.winProb, teamB.color, 'right')}
      </div>

      <div class="analysis-block">
        <h3>战术解读</h3>
        <p>${escapeHtml(result.analysis)}</p>
      </div>

      <div class="factors-grid">
        ${result.keyFactors
          .map(
            (f, i) => `
          <div class="factor-chip" style="--delay:${i * 0.08}s">
            <span class="factor-num">${i + 1}</span>
            ${escapeHtml(f)}
          </div>`,
          )
          .join('')}
      </div>

      <div class="watch-grid">
        ${result.playersToWatch
          .map(
            (p) => `
          <article class="watch-card">
            <span class="watch-team">${escapeHtml(p.team)}</span>
            <strong>${escapeHtml(p.player)}</strong>
            <p>${escapeHtml(p.reason)}</p>
          </article>`,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderHistory(entries: HistoryEntry[]) {
  if (!entries.length) {
    return '<p class="empty-tip">暂无历史记录，完成首次预测后会保存在本地。</p>'
  }
  return entries
    .map(
      (e) => `
    <button type="button" class="history-item" data-history="${e.id}">
      <span class="history-time">${escapeHtml(e.time)}</span>
      <span class="history-match">${escapeHtml(e.teamA)} vs ${escapeHtml(e.teamB)}</span>
      <span class="history-score">${escapeHtml(e.result.predictedScore)} · ${escapeHtml(e.stage)}</span>
    </button>`,
    )
    .join('')
}

export function createApp(root: HTMLElement) {
  let settings = loadSettings()
  let history = loadHistory()
  let theme: AppTheme = loadTheme()

  function applyTheme(next: AppTheme) {
    theme = next
    document.documentElement.dataset.theme = next
    saveTheme(next)
  }

  applyTheme(theme)

  const liveController = createLiveController((homeCn, awayCn) => {
    const teamA = findTeam(homeCn)
    const teamB = findTeam(awayCn)
    if (!teamA || !teamB) return
    setState({
      view: 'predict',
      teamA,
      teamB,
      stage: '小组赛',
      result: null,
      error: null,
      activeGroup: findGroupByTeam(homeCn) ?? state.activeGroup,
    })
    saveView('predict')
    document.querySelector('.arena-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  const chatController = createChatController(
    () => settings,
    () => liveController.getBoard(),
  )

  const state: AppState = {
    view: loadView(),
    activeGroup: 'A',
    teamA: findTeam('墨西哥') ?? null,
    teamB: findTeam('南非') ?? null,
    stage: '小组赛',
    loading: false,
    error: null,
    result: null,
    settingsOpen: false,
    historyOpen: false,
  }

  function setState(patch: Partial<AppState>) {
    Object.assign(state, patch)
    render()
  }

  function selectTeam(team: TeamInfo) {
    if (!state.teamA || (state.teamA && state.teamB && state.teamA.name !== team.name && state.teamB.name !== team.name)) {
      if (!state.teamA) setState({ teamA: team, result: null, error: null })
      else if (!state.teamB && state.teamA.name !== team.name) setState({ teamB: team, result: null, error: null })
      else setState({ teamA: team, teamB: null, result: null, error: null })
      return
    }
    if (state.teamA?.name === team.name) setState({ teamA: state.teamB, teamB: null, result: null, error: null })
    else if (state.teamB?.name === team.name) setState({ teamB: null, result: null, error: null })
    else if (!state.teamB) setState({ teamB: team, result: null, error: null })
    else setState({ teamA: team, teamB: state.teamA, result: null, error: null })
  }

  async function runPredict() {
    if (!state.teamA || !state.teamB) {
      setState({ error: '请先选择两支球队' })
      return
    }
    if (state.teamA.name === state.teamB.name) {
      setState({ error: '请选择不同的两支球队' })
      return
    }

    setState({ loading: true, error: null, result: null })
    try {
      const result = await predictMatch(state.teamA, state.teamB, state.stage, settings)
      const entry: HistoryEntry = {
        id: uid(),
        time: new Date().toLocaleString('zh-CN'),
        stage: state.stage,
        teamA: state.teamA.name,
        teamB: state.teamB.name,
        result,
      }
      pushHistory(entry)
      history = loadHistory()
      setState({ result, loading: false })
      requestAnimationFrame(() => {
        document.querySelectorAll<HTMLElement>('.prob-fill').forEach((el) => {
          el.style.width = el.style.getPropertyValue('--target')
        })
      })
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : '预测失败' })
    }
  }

  function applyFeatured(group: string, teamA: string, teamB: string, stage: MatchStage) {
    const a = findTeam(teamA)
    const b = findTeam(teamB)
    if (!a || !b) return
    setState({
      activeGroup: group,
      teamA: a,
      teamB: b,
      stage,
      result: null,
      error: null,
    })
  }

  function renderSettingsPanel() {
    return `
      <div class="drawer ${state.settingsOpen ? 'open' : ''}" id="settings-drawer">
        <div class="drawer-backdrop" data-close="settings"></div>
        <aside class="drawer-panel">
          <header class="drawer-head">
            <h2>⚙️ API 设置</h2>
            <button type="button" class="icon-btn" data-close="settings" aria-label="关闭">✕</button>
          </header>
          <form class="settings-form" id="settings-form">
            <label class="toggle-row">
              <input type="checkbox" name="demoMode" ${settings.demoMode ? 'checked' : ''} />
              <span>本地神算（读取 skill.md，无需 API）</span>
            </label>
            <label>
              <span>API Key</span>
              <input type="password" name="apiKey" value="${escapeHtml(settings.apiKey)}" placeholder="sk-..." autocomplete="off" />
            </label>
            <label>
              <span>Base URL</span>
              <input type="text" name="baseUrl" value="${escapeHtml(settings.baseUrl)}" />
            </label>
            <label>
              <span>Model</span>
              <input type="text" name="model" value="${escapeHtml(settings.model)}" placeholder="deepseek-chat" />
            </label>
            <label class="toggle-row">
              <input type="checkbox" name="useProxy" ${settings.useProxy ? 'checked' : ''} />
              <span>开发代理（npm run dev 时走 /api/llm）</span>
            </label>
            <p class="settings-tip">默认开启本地神算：按 skill.md 资料库 + 规则引擎输出分析。关闭并填入 DeepSeek Key 可切换大模型深度推理。</p>
            <button type="submit" class="btn btn-primary">保存设置</button>
          </form>
        </aside>
      </div>
    `
  }

  function renderHistoryPanel() {
    return `
      <div class="drawer ${state.historyOpen ? 'open' : ''}" id="history-drawer">
        <div class="drawer-backdrop" data-close="history"></div>
        <aside class="drawer-panel">
          <header class="drawer-head">
            <h2>📋 预测历史</h2>
            <button type="button" class="icon-btn" data-close="history" aria-label="关闭">✕</button>
          </header>
          <div class="history-list">${renderHistory(history)}</div>
          <button type="button" class="btn btn-ghost" id="clear-history">清空历史</button>
        </aside>
      </div>
    `
  }

  function render() {
    const group = GROUPS.find((g) => g.id === state.activeGroup)!
    const fixtures = groupFixtures(state.activeGroup)

    root.innerHTML = `
      <div class="stadium-bg">
        <div class="sky-layer" aria-hidden="true">
          <div class="sky-sun"></div>
          <div class="sky-cloud sky-cloud-1"></div>
          <div class="sky-cloud sky-cloud-2"></div>
          <div class="sky-cloud sky-cloud-3"></div>
        </div>
        <div class="lights"></div>
        <svg class="pitch-svg" viewBox="0 0 800 520" aria-hidden="true">
          <rect x="40" y="40" width="720" height="440" fill="none" stroke-width="2"/>
          <line x1="400" y1="40" x2="400" y2="480" stroke-width="2"/>
          <circle cx="400" cy="260" r="60" fill="none" stroke-width="2"/>
          <rect x="40" y="160" width="100" height="200" fill="none" stroke-width="2"/>
          <rect x="660" y="160" width="100" height="200" fill="none" stroke-width="2"/>
        </svg>
      </div>

      <div class="app-shell">
        <header class="top-bar">
          <div class="brand">
            <div class="brand-emblem">⚽</div>
            <div>
              <h1>绿茵神算</h1>
              <p>World Cup 2026 · AI Prediction Console</p>
            </div>
          </div>
          <div class="top-actions">
            <nav class="main-tabs" aria-label="主功能">
              <button type="button" class="main-tab ${state.view === 'live' ? 'active' : ''}" data-view="live">🔴 2026 实时世界杯</button>
              <button type="button" class="main-tab ${state.view === 'predict' ? 'active' : ''}" data-view="predict">📊 预测台</button>
              <button type="button" class="main-tab ${state.view === 'chat' ? 'active' : ''}" data-view="chat">💬 神算问答</button>
            </nav>
            <button type="button" class="theme-toggle" id="toggle-theme" title="切换主题">
              <span class="theme-toggle-icon">${theme === 'night' ? '☀️' : '🌙'}</span>
              <span class="theme-toggle-label">${theme === 'night' ? '白天场' : '夜间场'}</span>
            </button>
            <span class="mode-pill ${settings.demoMode ? 'demo' : 'live'}">${settings.demoMode ? '本地神算' : 'API 模式'}</span>
            <button type="button" class="btn btn-ghost" id="open-history">历史</button>
            <button type="button" class="btn btn-ghost" id="open-settings">设置</button>
          </div>
        </header>

        <main class="view-panel view-panel--${state.view}">
        ${state.view === 'live' ? renderLiveSectionShell() : ''}
        ${state.view === 'chat' ? renderChatShell() : ''}
        ${state.view === 'predict' ? `
        <section class="featured-row">
          ${FEATURED_MATCHES.map(
            (m) => `
            <button type="button" class="featured-chip" data-featured="${m.group}|${m.teamA}|${m.teamB}|${m.stage}">
              <span class="featured-label">${escapeHtml(m.label)}</span>
              <span>${escapeHtml(m.teamA)} vs ${escapeHtml(m.teamB)}</span>
            </button>`,
          ).join('')}
        </section>

        <div class="layout-grid">
          <aside class="group-panel">
            <h2>小组赛区</h2>
            <div class="group-tabs">
              ${GROUPS.map(
                (g) => `
                <button type="button" class="group-tab ${g.id === state.activeGroup ? 'active' : ''}" data-group="${g.id}">
                  ${g.id}
                </button>`,
              ).join('')}
            </div>
            <div class="team-grid">
              ${group.teams
                .map((team) => {
                  const selected = state.teamA?.name === team.name || state.teamB?.name === team.name
                  const slot = state.teamA?.name === team.name ? 'A' : state.teamB?.name === team.name ? 'B' : ''
                  return `
                  <button type="button" class="team-card ${selected ? 'selected' : ''}" data-team="${team.name}" style="--team-color:${team.color}">
                    <span class="team-flag">${team.flag}</span>
                    <span class="team-name">${escapeHtml(team.name)}</span>
                    <span class="team-tier">${TIER_LABELS[team.tier]}</span>
                    ${slot ? `<span class="team-slot">${slot}</span>` : ''}
                  </button>`
                })
                .join('')}
            </div>

            <div class="fixture-list">
              <h3>${state.activeGroup} 组对阵</h3>
              ${fixtures
                .map(
                  ([a, b]) => `
                <button type="button" class="fixture-btn" data-fixture="${a.name}|${b.name}">
                  ${a.flag} ${escapeHtml(a.name)} <span>vs</span> ${escapeHtml(b.name)} ${b.flag}
                </button>`,
                )
                .join('')}
            </div>
          </aside>

          <main class="arena-panel">
            <div class="arena-card">
              <div class="stage-row">
                <label for="stage-select">赛事阶段</label>
                <select id="stage-select">
                  ${STAGES.map((s) => `<option value="${s}" ${s === state.stage ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>

              <div class="versus-stage">
                <div class="versus-slot ${state.teamA ? 'filled' : ''}" style="${state.teamA ? `--team-color:${state.teamA.color}` : ''}">
                  ${state.teamA ? `<span class="v-flag">${state.teamA.flag}</span><span class="v-name">${escapeHtml(state.teamA.name)}</span>` : '<span class="v-placeholder">点击左侧选主队</span>'}
                </div>
                <div class="versus-core">
                  <span class="vs-ring">VS</span>
                  ${state.loading ? '<div class="loader"></div>' : ''}
                </div>
                <div class="versus-slot ${state.teamB ? 'filled' : ''}" style="${state.teamB ? `--team-color:${state.teamB.color}` : ''}">
                  ${state.teamB ? `<span class="v-flag">${state.teamB.flag}</span><span class="v-name">${escapeHtml(state.teamB.name)}</span>` : '<span class="v-placeholder">点击左侧选客队</span>'}
                </div>
              </div>

              ${state.error ? `<p class="error-banner">${escapeHtml(state.error)}</p>` : ''}

              <div class="arena-actions">
                <button type="button" class="btn btn-ghost" id="swap-teams" ${!state.teamA || !state.teamB ? 'disabled' : ''}>交换主客</button>
                <button type="button" class="btn btn-primary btn-glow" id="run-predict" ${state.loading ? 'disabled' : ''}>
                  ${state.loading ? '神算推演中…' : '开始预测'}
                </button>
                <button type="button" class="btn btn-ghost" id="clear-teams">清空选择</button>
              </div>
            </div>

            ${state.result && state.teamA && state.teamB ? renderResult(state.result, state.teamA, state.teamB) : `
              <div class="empty-arena">
                <div class="trophy-icon">🏆</div>
                <h3>选好对阵，一键神算</h3>
                <p>从 12 个小组挑选两支球队，或点上方「揭幕战」快捷入口。预测结果将以比分牌 + 胜平负概率可视化呈现。</p>
              </div>
            `}
          </main>
        </div>
        ` : ''}
        </main>

        <footer class="footer-note">
          仅供球迷娱乐讨论 · 基于 <a href="https://github.com/TradingAi666/worldcup2026-prediction-skill" target="_blank" rel="noreferrer">worldcup2026-prediction-skill</a>
        </footer>
      </div>

      ${renderSettingsPanel()}
      ${renderHistoryPanel()}
    `

    bindEvents()
    if (state.view === 'live') liveController.paint()
    if (state.view === 'chat') {
      chatController.paint()
      chatController.bind()
    }
  }

  function bindEvents() {
    root.querySelectorAll('[data-view]').forEach((el) => {
      el.addEventListener('click', () => {
        const view = (el as HTMLElement).dataset.view as AppView
        saveView(view)
        setState({ view })
      })
    })

    root.querySelectorAll('[data-group]').forEach((el) => {
      el.addEventListener('click', () => setState({ activeGroup: (el as HTMLElement).dataset.group! }))
    })

    root.querySelectorAll('[data-team]').forEach((el) => {
      el.addEventListener('click', () => {
        const name = (el as HTMLElement).dataset.team!
        const team = findTeam(name)
        if (team) selectTeam(team)
      })
    })

    root.querySelectorAll('[data-fixture]').forEach((el) => {
      el.addEventListener('click', () => {
        const [a, b] = (el as HTMLElement).dataset.fixture!.split('|')
        const teamA = findTeam(a)
        const teamB = findTeam(b)
        if (teamA && teamB) setState({ teamA, teamB, result: null, error: null })
      })
    })

    root.querySelectorAll('[data-featured]').forEach((el) => {
      el.addEventListener('click', () => {
        const [group, teamA, teamB, stage] = (el as HTMLElement).dataset.featured!.split('|')
        applyFeatured(group, teamA, teamB, stage as MatchStage)
      })
    })

    root.querySelector('#stage-select')?.addEventListener('change', (e) => {
      setState({ stage: (e.target as HTMLSelectElement).value as MatchStage, result: null })
    })

    root.querySelector('#run-predict')?.addEventListener('click', runPredict)
    root.querySelector('#swap-teams')?.addEventListener('click', () => {
      if (state.teamA && state.teamB) setState({ teamA: state.teamB, teamB: state.teamA, result: null })
    })
    root.querySelector('#clear-teams')?.addEventListener('click', () => {
      setState({ teamA: null, teamB: null, result: null, error: null })
    })

    root.querySelector('#open-settings')?.addEventListener('click', () => setState({ settingsOpen: true }))
    root.querySelector('#open-history')?.addEventListener('click', () => setState({ historyOpen: true }))

    root.querySelector('#toggle-theme')?.addEventListener('click', () => {
      applyTheme(theme === 'night' ? 'day' : 'night')
      render()
    })

    root.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = (el as HTMLElement).dataset.close
        if (target === 'settings') setState({ settingsOpen: false })
        if (target === 'history') setState({ historyOpen: false })
      })
    })

    root.querySelector('#settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const form = e.target as HTMLFormElement
      const data = new FormData(form)
      settings = {
        demoMode: data.get('demoMode') === 'on',
        apiKey: String(data.get('apiKey') ?? ''),
        baseUrl: String(data.get('baseUrl') ?? ''),
        model: String(data.get('model') ?? 'deepseek-chat'),
        useProxy: data.get('useProxy') === 'on',
      }
      saveSettings(settings)
      setState({ settingsOpen: false })
    })

    root.querySelector('#clear-history')?.addEventListener('click', () => {
      clearHistory()
      history = []
      render()
    })

    root.querySelectorAll('[data-history]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.history!
        const entry = history.find((h) => h.id === id)
        if (!entry) return
        const teamA = findTeam(entry.teamA)
        const teamB = findTeam(entry.teamB)
        if (!teamA || !teamB) return
        setState({
          historyOpen: false,
          teamA,
          teamB,
          stage: entry.stage,
          result: entry.result,
          activeGroup: findGroupByTeam(entry.teamA) ?? state.activeGroup,
        })
        requestAnimationFrame(() => {
          document.querySelectorAll<HTMLElement>('.prob-fill').forEach((node) => {
            node.style.width = node.style.getPropertyValue('--target')
          })
        })
      })
    })
  }

  render()
  liveController.start()
}
