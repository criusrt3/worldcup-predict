import type { GroupInfo, TeamInfo } from './types'

function t(name: string, flag: string, tier: TeamInfo['tier'], color: string): TeamInfo {
  return { name, flag, tier, color }
}

export const GROUPS: GroupInfo[] = [
  {
    id: 'A',
    teams: [
      t('墨西哥', '🇲🇽', 3, '#006847'),
      t('南非', '🇿🇦', 4, '#007749'),
      t('韩国', '🇰🇷', 3, '#cd2e3a'),
      t('捷克', '🇨🇿', 4, '#11457e'),
    ],
  },
  {
    id: 'B',
    teams: [
      t('加拿大', '🇨🇦', 3, '#ff0000'),
      t('波黑', '🇧🇦', 4, '#002395'),
      t('卡塔尔', '🇶🇦', 4, '#8a1538'),
      t('瑞士', '🇨🇭', 3, '#ff0000'),
    ],
  },
  {
    id: 'C',
    teams: [
      t('巴西', '🇧🇷', 1, '#009c3b'),
      t('摩洛哥', '🇲🇦', 2, '#c1272d'),
      t('海地', '🇭🇹', 4, '#00209f'),
      t('苏格兰', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 4, '#0065bd'),
    ],
  },
  {
    id: 'D',
    teams: [
      t('美国', '🇺🇸', 3, '#3c3b6e'),
      t('巴拉圭', '🇵🇾', 4, '#d52b1e'),
      t('澳大利亚', '🇦🇺', 4, '#00843d'),
      t('土耳其', '🇹🇷', 3, '#e30a17'),
    ],
  },
  {
    id: 'E',
    teams: [
      t('德国', '🇩🇪', 2, '#000000'),
      t('库拉索', '🇨🇼', 4, '#002b7f'),
      t('科特迪瓦', '🇨🇮', 4, '#f77f00'),
      t('厄瓜多尔', '🇪🇨', 3, '#ffdd00'),
    ],
  },
  {
    id: 'F',
    teams: [
      t('荷兰', '🇳🇱', 2, '#ff6600'),
      t('日本', '🇯🇵', 2, '#bc002d'),
      t('瑞典', '🇸🇪', 3, '#006aa7'),
      t('突尼斯', '🇹🇳', 4, '#e70013'),
    ],
  },
  {
    id: 'G',
    teams: [
      t('比利时', '🇧🇪', 3, '#fdda24'),
      t('埃及', '🇪🇬', 3, '#ce1126'),
      t('伊朗', '🇮🇷', 4, '#239f40'),
      t('新西兰', '🇳🇿', 4, '#00247d'),
    ],
  },
  {
    id: 'H',
    teams: [
      t('西班牙', '🇪🇸', 1, '#c60b1e'),
      t('佛得角', '🇨🇻', 4, '#003893'),
      t('沙特', '🇸🇦', 4, '#006c35'),
      t('乌拉圭', '🇺🇾', 2, '#0038a8'),
    ],
  },
  {
    id: 'I',
    teams: [
      t('法国', '🇫🇷', 1, '#0055a4'),
      t('塞内加尔', '🇸🇳', 3, '#00853f'),
      t('伊拉克', '🇮🇶', 4, '#ce1126'),
      t('挪威', '🇳🇴', 2, '#ba0c2f'),
    ],
  },
  {
    id: 'J',
    teams: [
      t('阿根廷', '🇦🇷', 1, '#74acdf'),
      t('阿尔及利亚', '🇩🇿', 4, '#006233'),
      t('奥地利', '🇦🇹', 3, '#ed2939'),
      t('约旦', '🇯🇴', 4, '#007a3d'),
    ],
  },
  {
    id: 'K',
    teams: [
      t('葡萄牙', '🇵🇹', 2, '#006600'),
      t('刚果金', '🇨🇩', 4, '#007fff'),
      t('乌兹别克斯坦', '🇺🇿', 4, '#1eb53a'),
      t('哥伦比亚', '🇨🇴', 2, '#fcd116'),
    ],
  },
  {
    id: 'L',
    teams: [
      t('英格兰', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 1, '#cf081f'),
      t('克罗地亚', '🇭🇷', 2, '#171796'),
      t('加纳', '🇬🇭', 4, '#006b3f'),
      t('巴拿马', '🇵🇦', 4, '#005293'),
    ],
  },
]

export const TIER_LABELS: Record<TeamInfo['tier'], string> = {
  1: '夺冠热门',
  2: '一线强队',
  3: '二线/东道主',
  4: '中游/新军',
}

export const FEATURED_MATCHES = [
  { label: '揭幕战', group: 'A', teamA: '墨西哥', teamB: '南非', stage: '小组赛' as const },
  { label: '死亡之组', group: 'C', teamA: '巴西', teamB: '摩洛哥', stage: '小组赛' as const },
  { label: '亚洲德比', group: 'F', teamA: '日本', teamB: '荷兰', stage: '小组赛' as const },
  { label: '巅峰对决', group: 'J', teamA: '阿根廷', teamB: '阿尔及利亚', stage: '小组赛' as const },
]

export function findTeam(name: string): TeamInfo | undefined {
  for (const g of GROUPS) {
    const team = g.teams.find((x) => x.name === name)
    if (team) return team
  }
}

export function findGroupByTeam(name: string): string | undefined {
  for (const g of GROUPS) {
    if (g.teams.some((x) => x.name === name)) return g.id
  }
}

export function groupFixtures(groupId: string): [TeamInfo, TeamInfo][] {
  const group = GROUPS.find((g) => g.id === groupId)
  if (!group) return []
  const [a, b, c, d] = group.teams
  return [
    [a, b],
    [a, c],
    [a, d],
    [b, c],
    [b, d],
    [c, d],
  ]
}
