import type { LiveMatch, LiveScoreboard, StageFilter } from './liveScore'
import {
  countByStage,
  fetchTournamentScoreboard,
  filterTodayMatches,
  formatBeijingClock,
  formatKickoffBeijing,
  getStageRibbonKind,
  groupFinishedByStage,
  sortTodayMatches,
  STAGE_ORDER,
  TOURNAMENT_MATCHES_TOTAL,
  type LiveMatchStatus,
} from './liveScore'
import {
  buildTournamentContext,
  getTeamQualBadge,
  nextKnockoutLabel,
  QUAL_CLASS,
  type TournamentContext,
} from './groupStandings'
import { loadLiveFilter, loadLiveSectionTab, loadLiveStageFilter, loadLiveTeamFilter, saveLiveFilter, saveLiveSectionTab, saveLiveStageFilter, saveLiveTeamFilter } from './storage'
import { filterMatchesByTeam, fuzzyMatchTeam, getTeamSearchEntries } from './teamFilter'
import type { LiveFilter, LiveSectionTab } from './types'

const SCHEDULE_PREVIEW_COUNT = 8

function sortNearestSchedule(matches: LiveMatch[]): LiveMatch[] {
  const rank: Record<LiveMatchStatus, number> = {
    live: 0,
    halftime: 0,
    scheduled: 1,
    finished: 2,
  }
  return [...matches].sort((a, b) => {
    const dr = rank[a.status] - rank[b.status]
    if (dr !== 0) return dr
    if (a.status === 'finished' && b.status === 'finished') {
      return new Date(b.startTimeIso).getTime() - new Date(a.startTimeIso).getTime()
    }
    return new Date(a.startTimeIso).getTime() - new Date(b.startTimeIso).getTime()
  })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusClass(status: LiveMatch['status']) {
  if (status === 'live') return 'live-status--live'
  if (status === 'halftime') return 'live-status--ht'
  if (status === 'finished') return 'live-status--ft'
  return 'live-status--pre'
}

function filterMatches(matches: LiveMatch[], filter: LiveFilter): LiveMatch[] {
  if (filter === 'live') return matches.filter((m) => m.isLive)
  if (filter === 'finished') return matches.filter((m) => m.status === 'finished')
  if (filter === 'scheduled') return matches.filter((m) => m.status === 'scheduled')
  return matches
}

function renderQualBadge(badge: { label: string; cls: string; hint: string } | null) {
  if (!badge?.label) return ''
  return `<span class="qual-badge ${badge.cls}" title="${escapeHtml(badge.hint)}">${escapeHtml(badge.label)}</span>`
}

function renderTeamSide(
  side: LiveMatch['home'],
  role: 'home' | 'away',
  showScore = false,
  qualBadge: { label: string; cls: string; hint: string } | null = null,
) {
  const logo = side.logo
    ? `<img class="live-logo" src="${escapeHtml(side.logo)}" alt="" loading="lazy" />`
    : `<span class="live-flag">${side.flag}</span>`

  return `
    <div class="live-side live-side--${role}" style="--team-color:${side.color}">
      <span class="live-role-tag">${role === 'home' ? '主' : '客'}</span>
      ${logo}
      <div class="live-side-info">
        <span class="live-team-name">${escapeHtml(side.name)}</span>
        ${renderQualBadge(qualBadge)}
        <span class="live-team-en">${escapeHtml(side.nameEn)}</span>
      </div>
      ${showScore ? `<strong class="live-score ${side.winner ? 'live-score--win' : ''}">${side.score}</strong>` : ''}
    </div>
  `
}

function renderScoreline(match: LiveMatch) {
  return `
    <div class="live-scoreline" aria-label="${escapeHtml(match.home.name)} ${match.home.score} 比 ${match.away.score} ${escapeHtml(match.away.name)}">
      <span class="live-scoreline-num ${match.home.winner ? 'live-scoreline-num--win' : ''}">${match.home.score}</span>
      <span class="live-scoreline-sep">:</span>
      <span class="live-scoreline-num ${match.away.winner ? 'live-scoreline-num--win' : ''}">${match.away.score}</span>
    </div>
  `
}

function filterByStage(matches: LiveMatch[], stageFilter: StageFilter): LiveMatch[] {
  if (stageFilter === 'all') return matches
  return matches.filter((m) => m.stage === stageFilter)
}

function renderLiveCard(match: LiveMatch, compact = false, emphasizeStage = false, ctx?: TournamentContext) {
  const clock =
    match.status === 'finished'
      ? 'FT'
      : match.isLive
        ? match.clock
        : formatBeijingClock(match.startTimeIso)
  const ribbonKind = getStageRibbonKind(match.stage)
  const homeQual = ctx ? getTeamQualBadge(ctx, match.home.name, match) : null
  const awayQual = ctx ? getTeamQualBadge(ctx, match.away.name, match) : null
  const advanceNote =
    match.status === 'finished' && match.stage !== '小组赛' && ctx
      ? (() => {
          const winner = match.home.winner ? match.home.name : match.away.winner ? match.away.name : null
          if (!winner) return ''
          return `<div class="live-advance-note">${escapeHtml(winner)} ${escapeHtml(nextKnockoutLabel(match.stage))}</div>`
        })()
      : ''

  return `
    <article class="live-card ${match.isLive ? 'live-card--active' : ''} ${match.status === 'finished' ? 'live-card--finished' : ''} ${compact ? 'live-card--compact' : ''}" data-live-match="${escapeHtml(match.home.name)}|${escapeHtml(match.away.name)}" data-live-stage="${escapeHtml(match.stage)}" tabindex="0">
      ${emphasizeStage ? `<div class="live-stage-ribbon live-stage-ribbon--${ribbonKind}">${escapeHtml(match.stageLabel)}</div>` : ''}
      <div class="live-card-head">
        <span class="live-status ${statusClass(match.status)}">
          ${match.isLive ? '<span class="live-dot"></span>' : ''}
          ${escapeHtml(match.statusLabel)}
        </span>
        <span class="live-meta-tag">${escapeHtml(match.stageLabel)}</span>
      </div>

      <div class="live-matchup">
        ${renderTeamSide(match.home, 'home', false, homeQual)}
        <div class="live-center">
          ${match.status !== 'scheduled' ? renderScoreline(match) : ''}
          <div class="live-clock">${escapeHtml(clock)}</div>
          <div class="live-period">${escapeHtml(match.status === 'finished' ? '全场结束' : match.periodLabel)}</div>
          ${match.status !== 'scheduled' ? `<div class="live-score-hint">${escapeHtml(match.home.name)} ${match.home.score}:${match.away.score} ${escapeHtml(match.away.name)}</div>` : ''}
          ${advanceNote}
        </div>
        ${renderTeamSide(match.away, 'away', false, awayQual)}
      </div>

      <footer class="live-card-foot">
        <span title="赛事阶段">🏆 ${escapeHtml(match.stageLabel)}</span>
        <span title="开球时间">🕐 ${escapeHtml(match.startTime)}</span>
        ${match.venue ? `<span title="球场">📍 ${escapeHtml(match.venue)}</span>` : ''}
        ${match.attendance ? `<span title="上座">👥 ${match.attendance.toLocaleString('zh-CN')}</span>` : ''}
      </footer>
    </article>
  `
}

function renderSectionTabs(active: LiveSectionTab, board: LiveScoreboard | null, ctx: TournamentContext) {
  const todayCount = board ? filterTodayMatches(board.matches).length : 0
  const groupCount = ctx.groups.filter((g) => g.finishedMatches > 0).length
  const tabs: { id: LiveSectionTab; label: string; count?: number }[] = [
    { id: 'schedule', label: '赛程', count: board?.totalCount },
    { id: 'standings', label: '积分榜', count: groupCount || undefined },
  ]

  return `
    <div class="live-section-tabs" role="tablist" aria-label="赛程视图">
      ${tabs
        .map(
          (t) => `
        <button type="button" class="live-section-tab ${active === t.id ? 'active' : ''}" data-live-section-tab="${t.id}" role="tab" aria-selected="${active === t.id}">
          ${escapeHtml(t.label)}
          ${t.count != null ? `<span class="live-filter-count">${t.id === 'schedule' && todayCount ? `${todayCount} 今日 · ${t.count}` : t.count}</span>` : ''}
        </button>`,
        )
        .join('')}
    </div>
  `
}

function renderTeamCombobox(selectedTeam: string, query: string) {
  const entries = getTeamSearchEntries()
  const inputValue = selectedTeam || query

  return `
    <div class="team-combobox-wrap">
      <span class="live-toolbar-label">球队</span>
      <div class="team-combobox" id="team-combobox">
        <input
          type="text"
          id="team-combobox-input"
          class="team-combobox-input"
          value="${escapeHtml(inputValue)}"
          placeholder="搜索球队（中/英文名）"
          autocomplete="off"
          aria-expanded="false"
          aria-controls="team-combobox-list"
          aria-autocomplete="list"
        />
        ${selectedTeam ? `<button type="button" class="team-combobox-clear" id="team-combobox-clear" aria-label="清除筛选">✕</button>` : ''}
        <ul class="team-combobox-list" id="team-combobox-list" role="listbox">
          <li role="option" class="team-combobox-option" data-team="" data-search="全部 all">
            <span class="team-combobox-flag">🌍</span>
            <span>全部球队</span>
          </li>
          ${entries
            .map(
              (e) => `
            <li role="option" class="team-combobox-option" data-team="${escapeHtml(e.name)}" data-search="${escapeHtml(e.searchKey)}">
              <span class="team-combobox-flag">${e.flag}</span>
              <span>${escapeHtml(e.name)}</span>
              <span class="team-combobox-group">${e.group} 组</span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>
    </div>
  `
}

function renderLiveToolbar(filter: LiveFilter, board: LiveScoreboard | null, teamFilter: string, teamQuery: string) {
  return `
    <div class="live-toolbar">
      ${renderFilterTabs(filter, board)}
      ${renderTeamCombobox(teamFilter, teamQuery)}
    </div>
  `
}

function renderFilterTabs(active: LiveFilter, board: LiveScoreboard | null) {
  const tabs: { id: LiveFilter; label: string; count?: number }[] = [
    { id: 'all', label: '全部', count: board?.totalCount },
    { id: 'live', label: '进行中', count: board?.liveCount },
    { id: 'finished', label: '已完赛', count: board?.finishedCount },
    { id: 'scheduled', label: '未开始', count: board?.scheduledCount },
  ]

  return `
    <div class="live-filters" role="tablist" aria-label="赛况筛选">
      ${tabs
        .map(
          (t) => `
        <button type="button" class="live-filter ${active === t.id ? 'active' : ''}" data-live-filter="${t.id}" role="tab" aria-selected="${active === t.id}">
          ${escapeHtml(t.label)}
          ${t.count != null ? `<span class="live-filter-count">${t.count}</span>` : ''}
        </button>`,
        )
        .join('')}
    </div>
  `
}

function renderStageFilters(active: StageFilter, finishedMatches: LiveMatch[]) {
  const counts = countByStage(finishedMatches)
  const tabs: { id: StageFilter; label: string; count?: number }[] = [
    { id: 'all', label: '全部阶段', count: finishedMatches.length },
    ...STAGE_ORDER.filter((s) => counts[s]).map((s) => ({
      id: s as StageFilter,
      label: s === '小组赛' ? '小组赛' : s,
      count: counts[s],
    })),
  ]

  return `
    <div class="live-stage-filters" role="tablist" aria-label="赛事阶段筛选">
      <span class="live-stage-filters-label">赛事阶段</span>
      ${tabs
        .map(
          (t) => `
        <button type="button" class="live-stage-filter ${active === t.id ? 'active' : ''}" data-stage-filter="${t.id}" role="tab" aria-selected="${active === t.id}">
          ${escapeHtml(t.label)}
          ${t.count != null ? `<span class="live-filter-count">${t.count}</span>` : ''}
        </button>`,
        )
        .join('')}
    </div>
  `
}

function renderStandingsSection(ctx: TournamentContext): string {
  const activeGroups = ctx.groups.filter((g) => g.finishedMatches > 0)
  if (!activeGroups.length && !ctx.hasKnockoutResults) return ''

  const tables = activeGroups
    .map(
      (g) => `
      <div class="standings-group">
        <header class="standings-group-head">
          <strong>${escapeHtml(g.displayId)}</strong>
          <span>${g.finishedMatches}/${g.totalMatches} 场</span>
        </header>
        <table class="standings-table">
          <thead>
            <tr><th>#</th><th>球队</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>进失</th><th>净</th><th>分</th><th>形势</th></tr>
          </thead>
          <tbody>
            ${g.teams
              .map(
                (t) => `
              <tr class="standings-row standings-row--${t.rank <= 2 ? 'zone' : t.rank === 3 ? 'third' : 'out'}">
                <td>${t.rank}</td>
                <td>${escapeHtml(t.name)}</td>
                <td>${t.played}</td>
                <td>${t.win}</td>
                <td>${t.draw}</td>
                <td>${t.loss}</td>
                <td>${t.gf}:${t.ga}</td>
                <td>${t.gd >= 0 ? '+' : ''}${t.gd}</td>
                <td><strong>${t.pts}</strong></td>
                <td>${renderQualBadge(t.qualLabel ? { label: t.qualLabel, cls: QUAL_CLASS[t.qualStatus], hint: t.qualHint } : null)}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`,
    )
    .join('')

  const knockoutStages = STAGE_ORDER.filter((s) => s !== '小组赛')
  const knockoutHtml = ctx.hasKnockoutResults
    ? `
    <div class="knockout-progress">
      <header class="standings-head">
        <h3>⚔️ 淘汰赛晋级</h3>
        <p>32 强 → 16 强 → 8 强 → 半决赛 → 决赛</p>
      </header>
      <div class="knockout-chips">
        ${[...ctx.knockoutAdvancers]
          .slice(0, 32)
          .map((name) => `<span class="knockout-chip">${escapeHtml(name)}</span>`)
          .join('')}
      </div>
    </div>`
    : knockoutStages.length
      ? `
    <div class="knockout-progress knockout-progress--pending">
      <header class="standings-head">
        <h3>⚔️ 淘汰赛阶段</h3>
        <p>小组赛结束后：32 强 · 16 强 · 8 强 · 半决赛 · 决赛 · 三四名</p>
      </header>
    </div>`
      : ''

  return `
    <div class="standings-panel standings-panel--tab">
      <header class="standings-head">
        <p>前两名直接晋级 32 强 · 8 个最佳第三名同样出线 · 悬停标签查看形势说明</p>
      </header>
      <div class="standings-grid">${tables}</div>
      ${knockoutHtml}
    </div>
  `
}

function renderGroupedFinished(matches: LiveMatch[], stageFilter: StageFilter, ctx: TournamentContext) {
  const scoped = filterByStage(matches, stageFilter)
  const stageGroups = groupFinishedByStage(scoped)

  if (!scoped.length) {
    return `
      ${renderStageFilters(stageFilter, matches)}
      <div class="live-empty live-empty--inline"><p>该阶段暂无已完赛比赛</p></div>
    `
  }

  return `
    ${renderStageFilters(stageFilter, matches)}
    <div class="live-results">
      ${stageGroups
        .map(
          (sg) => `
        <section class="live-stage-group">
          <header class="live-stage-head live-stage-head--${getStageRibbonKind(sg.stage)}">
            <div>
              <h3>${escapeHtml(sg.stageTitle)}</h3>
              <p>${sg.count} 场已完赛</p>
            </div>
            <span class="live-stage-icon">${sg.stage === '小组赛' ? '🏟️' : sg.stage === '决赛' ? '🏆' : '⚔️'}</span>
          </header>
          ${sg.dates
            .map(
              (g) => `
            <div class="live-date-group">
              <header class="live-date-head">
                <h4>${escapeHtml(g.label)}</h4>
                <span>${g.matches.length} 场</span>
              </header>
              <div class="live-results-grid">
                ${g.matches.map((m) => renderLiveCard(m, true, true, ctx)).join('')}
              </div>
            </div>`,
            )
            .join('')}
        </section>`,
        )
        .join('')}
    </div>
  `
}

function renderTodayBlock(today: LiveMatch[], todayLabel: string, ctx: TournamentContext): string {
  if (!today.length) {
    return `
      <div class="live-today live-today--hint live-today--compact">
        <p>📅 ${escapeHtml(todayLabel)} · 今日暂无比赛</p>
      </div>
    `
  }

  return `
    <section class="live-today live-today--inline">
      <header class="live-today-head">
        <div>
          <h3>📅 今日赛程</h3>
          <p>${escapeHtml(todayLabel)} · 北京时间</p>
        </div>
        <span class="live-today-count">${today.length} 场</span>
      </header>
      <div class="live-track live-track--today">
        ${today.map((m) => renderLiveCard(m, false, false, ctx)).join('')}
      </div>
    </section>
  `
}

function renderSchedulePanel(
  board: LiveScoreboard,
  filter: LiveFilter,
  stageFilter: StageFilter,
  ctx: TournamentContext,
  teamFilter: string,
  scheduleExpanded: boolean,
): string {
  const base = filterMatchesByTeam(board.matches, teamFilter)
  const filtered = filterMatches(base, filter)
  const todayLabel = new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  if (filter === 'finished') {
    const finishedAll = base.filter((m) => m.status === 'finished')
    if (!filtered.length) {
      return `
        ${renderStageFilters(stageFilter, finishedAll)}
        <div class="live-empty live-empty--inline">
          <p>${teamFilter ? `「${escapeHtml(teamFilter)}」暂无已完赛` : '暂无已完赛比赛'}</p>
        </div>
      `
    }
    return renderGroupedFinished(filtered, stageFilter, ctx)
  }

  const showTodaySection = filter === 'all' || filter === 'scheduled' || filter === 'live'
  const allToday = filterTodayMatches(base)
  const todayIds = new Set(allToday.map((m) => m.id))
  const today = showTodaySection ? sortTodayMatches(filterMatches(allToday, filter)) : []
  const rest = showTodaySection ? filtered.filter((m) => !todayIds.has(m.id)) : filtered

  if (!today.length && !rest.length) {
    if (filter === 'live') {
      const next = sortTodayMatches(filterTodayMatches(base)).find((m) => m.status === 'scheduled')
      if (next) {
        return `
          <div class="live-today live-today--hint">
            <p>当前无进行中比赛 · 下一场 <strong>${escapeHtml(next.home.name)} vs ${escapeHtml(next.away.name)}</strong> · ${escapeHtml(formatKickoffBeijing(next.startTimeIso))}</p>
          </div>
        `
      }
    }
    return `
      <div class="live-empty live-empty--inline">
        <p>${teamFilter ? `「${escapeHtml(teamFilter)}」在当前筛选下暂无比赛` : '当前筛选下暂无比赛'}</p>
        <span>试试切换「全部」或清除球队筛选</span>
      </div>
    `
  }

  const parts: string[] = []
  if (showTodaySection) parts.push(renderTodayBlock(today, todayLabel, ctx))
  if (rest.length) {
    const sorted = sortNearestSchedule(rest)
    const visible = scheduleExpanded ? sorted : sorted.slice(0, SCHEDULE_PREVIEW_COUNT)
    const hiddenCount = Math.max(0, sorted.length - SCHEDULE_PREVIEW_COUNT)
    parts.push(`
      <header class="live-rest-head">
        <h3>${teamFilter ? `${escapeHtml(teamFilter)} · 其余场次` : '全部赛程'}</h3>
        <span>共 ${sorted.length} 场${!scheduleExpanded && hiddenCount ? ` · 显示 ${visible.length} 场` : ''}</span>
      </header>
      <div class="live-track">
        ${visible.map((m) => renderLiveCard(m, false, false, ctx)).join('')}
      </div>
      ${
        hiddenCount > 0
          ? scheduleExpanded
            ? `<div class="live-show-more-wrap"><button type="button" class="btn btn-ghost btn-sm live-show-more" id="live-show-less">收起</button></div>`
            : `<div class="live-show-more-wrap"><button type="button" class="btn btn-ghost btn-sm live-show-more" id="live-show-more">显示更多（还有 ${hiddenCount} 场）</button></div>`
          : ''
      }
    `)
  }
  return parts.join('')
}

function renderStandingsPanel(ctx: TournamentContext): string {
  const activeGroups = ctx.groups.filter((g) => g.finishedMatches > 0)
  if (!activeGroups.length && !ctx.hasKnockoutResults) {
    return `
      <div class="live-empty live-empty--inline">
        <p>暂无积分榜数据</p>
        <span>小组赛开赛后自动更新 · 48 队 12 组</span>
      </div>
    `
  }
  return renderStandingsSection(ctx)
}

function renderLivePanelContent(
  board: LiveScoreboard | null,
  error: string | null,
  loading: boolean,
  filter: LiveFilter,
  stageFilter: StageFilter,
  sectionTab: LiveSectionTab,
  ctx: TournamentContext,
  teamFilter: string,
  teamQuery: string,
  scheduleExpanded: boolean,
) {
  if (loading && !board) {
    return `
      <div class="live-loading">
        <div class="loader"></div>
        <p>正在拉取 2026 世界杯赛况与历史战果…</p>
      </div>
    `
  }

  if (error && !board) {
    return `
      <div class="live-error">
        <p>${escapeHtml(error)}</p>
        <button type="button" class="btn btn-ghost btn-sm" id="retry-live">重试</button>
      </div>
    `
  }

  if (!board || board.matches.length === 0) {
    return `
      <div class="live-empty">
        <p>暂无比赛数据</p>
        <span>世界杯期间会自动同步赛程与战果</span>
      </div>
    `
  }

  const sectionTabsHtml = renderSectionTabs(sectionTab, board, ctx)
  const toolbarHtml = sectionTab === 'schedule' ? renderLiveToolbar(filter, board, teamFilter, teamQuery) : ''

  let panelHtml = ''
  if (sectionTab === 'standings') {
    panelHtml = renderStandingsPanel(ctx)
  } else {
    panelHtml = renderSchedulePanel(board, filter, stageFilter, ctx, teamFilter, scheduleExpanded)
  }

  return `
    ${sectionTabsHtml}
    ${toolbarHtml}
    <div class="live-tab-panel">${panelHtml}</div>
  `
}

export function renderLiveSectionShell() {
  return `
    <section class="live-section" id="live-section">
      <header class="live-section-head">
        <div>
          <h2><span class="live-title-dot"></span> 2026 实时世界杯</h2>
          <p class="live-section-sub" id="live-section-sub">ESPN 官方数据 · 赛况 & 战果 · 每 45 秒刷新 · 点击比赛可跳转预测台</p>
        </div>
        <div class="live-section-actions">
          <span class="live-updated" id="live-updated">—</span>
          <span class="live-count" id="live-count"></span>
          <span class="live-finished-count" id="live-finished-count"></span>
          <button type="button" class="btn btn-ghost btn-sm" id="refresh-live">刷新</button>
        </div>
      </header>
      <div id="live-panel-content"></div>
    </section>
  `
}

export type LiveMatchSelectHandler = (homeCn: string, awayCn: string, match?: LiveMatch) => void

export type LiveBoardUpdateHandler = (board: LiveScoreboard | null) => void

export function createLiveController(onSelect: LiveMatchSelectHandler, onBoardUpdate?: LiveBoardUpdateHandler) {
  let timer: number | null = null
  let board: LiveScoreboard | null = null
  let error: string | null = null
  let loading = false
  let filter: LiveFilter = loadLiveFilter()
  let sectionTab: LiveSectionTab = loadLiveSectionTab()
  let stageFilter: StageFilter = loadLiveStageFilter()
  let teamFilter: string = loadLiveTeamFilter()
  let teamFilterQuery = ''
  let scheduleExpanded = false
  let teamComboboxDocHandler: ((e: MouseEvent) => void) | null = null

  function bindTeamCombobox() {
    const root = document.getElementById('team-combobox')
    const input = document.getElementById('team-combobox-input') as HTMLInputElement | null
    const list = document.getElementById('team-combobox-list')
    const clearBtn = document.getElementById('team-combobox-clear')
    if (!root || !input || !list) return

    const syncList = (q: string) => {
      list.querySelectorAll<HTMLElement>('.team-combobox-option').forEach((el) => {
        const search = el.dataset.search ?? ''
        const team = el.dataset.team ?? ''
        const label = el.querySelector('span:nth-child(2)')?.textContent ?? team
        const visible = team === '' ? fuzzyMatchTeam(q, search, '全部球队') : fuzzyMatchTeam(q, search, label)
        el.classList.toggle('hidden', !visible)
      })
    }

    const open = () => {
      root.classList.add('team-combobox--open')
      input.setAttribute('aria-expanded', 'true')
    }
    const close = () => {
      root.classList.remove('team-combobox--open')
      input.setAttribute('aria-expanded', 'false')
    }

    input.addEventListener('focus', () => {
      open()
      syncList(input.value)
    })

    input.addEventListener('input', () => {
      teamFilterQuery = input.value
      if (teamFilter && input.value !== teamFilter) {
        teamFilter = ''
        saveLiveTeamFilter('')
      }
      open()
      syncList(input.value)
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close()
        input.blur()
      }
    })

    list.querySelectorAll('.team-combobox-option').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        teamFilter = (el as HTMLElement).dataset.team ?? ''
        teamFilterQuery = ''
        scheduleExpanded = false
        saveLiveTeamFilter(teamFilter)
        close()
        paint()
      })
    })

    clearBtn?.addEventListener('click', () => {
      teamFilter = ''
      teamFilterQuery = ''
      scheduleExpanded = false
      saveLiveTeamFilter('')
      paint()
    })

    if (teamComboboxDocHandler) document.removeEventListener('mousedown', teamComboboxDocHandler)
    teamComboboxDocHandler = (e: MouseEvent) => {
      if (!root.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', teamComboboxDocHandler)
  }

  function bindLiveCards() {
    document.querySelectorAll('[data-live-match]').forEach((el) => {
      el.addEventListener('click', () => {
        const [home, away] = (el as HTMLElement).dataset.liveMatch!.split('|')
        const stage = (el as HTMLElement).dataset.liveStage
        const match = board?.matches.find(
          (m) => m.home.name === home && m.away.name === away && (!stage || m.stage === stage),
        )
        onSelect(home, away, match)
      })
      el.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') (el as HTMLElement).click()
      })
    })
  }

  function bindFilters() {
    document.querySelectorAll('[data-live-section-tab]').forEach((el) => {
      el.addEventListener('click', () => {
        sectionTab = (el as HTMLElement).dataset.liveSectionTab as LiveSectionTab
        scheduleExpanded = false
        saveLiveSectionTab(sectionTab)
        paint()
      })
    })
    document.querySelectorAll('[data-live-filter]').forEach((el) => {
      el.addEventListener('click', () => {
        filter = (el as HTMLElement).dataset.liveFilter as LiveFilter
        scheduleExpanded = false
        saveLiveFilter(filter)
        paint()
      })
    })
    document.querySelectorAll('[data-stage-filter]').forEach((el) => {
      el.addEventListener('click', () => {
        stageFilter = (el as HTMLElement).dataset.stageFilter as StageFilter
        scheduleExpanded = false
        saveLiveStageFilter(stageFilter)
        paint()
      })
    })
    document.getElementById('live-show-more')?.addEventListener('click', () => {
      scheduleExpanded = true
      paint()
    })
    document.getElementById('live-show-less')?.addEventListener('click', () => {
      scheduleExpanded = false
      paint()
      document.querySelector('.live-rest-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function updateMeta() {
    const updated = document.getElementById('live-updated')
    const count = document.getElementById('live-count')
    const finishedCount = document.getElementById('live-finished-count')
    const sub = document.getElementById('live-section-sub')
    if (updated) updated.textContent = board ? `更新 ${board.fetchedAt}（北京时间）` : '—'
    if (count) {
      count.textContent = board?.liveCount ? `${board.liveCount} 场进行中` : ''
      count.classList.toggle('has-live', !!board?.liveCount)
    }
    if (finishedCount) {
      finishedCount.textContent = board?.finishedCount ? `${board.finishedCount} 场已完赛` : ''
    }
    if (sub && board) {
      const totalHint =
        board.totalCount >= TOURNAMENT_MATCHES_TOTAL
          ? `${board.totalCount} 场`
          : `${board.totalCount}/${TOURNAMENT_MATCHES_TOTAL} 场`
      sub.textContent = `ESPN 官方 · 48队全赛程 ${totalHint} · 已完赛 ${board.finishedCount} · 未开始 ${board.scheduledCount} · 北京时间 · 每 45 秒刷新`
    }
  }

  function paint() {
    const el = document.getElementById('live-panel-content')
    if (!el) return
    const ctx = buildTournamentContext(board)
    el.innerHTML = renderLivePanelContent(
      board,
      error,
      loading,
      filter,
      stageFilter,
      sectionTab,
      ctx,
      teamFilter,
      teamFilterQuery,
      scheduleExpanded,
    )
    updateMeta()
    bindLiveCards()
    bindFilters()
    bindTeamCombobox()
    document.getElementById('retry-live')?.addEventListener('click', () => refresh())
    document.getElementById('refresh-live')?.addEventListener('click', () => refresh())
  }

  async function refresh() {
    loading = !board
    error = null
    paint()
    try {
      board = await fetchTournamentScoreboard()
      error = null
    } catch (e) {
      error = e instanceof Error ? e.message : '赛况加载失败'
    } finally {
      loading = false
      paint()
      onBoardUpdate?.(board)
    }
  }

  function start() {
    stop()
    refresh()
    timer = window.setInterval(refresh, 45_000)
  }

  function stop() {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
  }

  return { start, stop, refresh, paint, getBoard: () => board }
}
