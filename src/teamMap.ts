import { findTeam } from './data'

/** ESPN / FIFA 英文队名 → 中文队名 */
export const EN_TO_CN: Record<string, string> = {
  Argentina: '阿根廷',
  Algeria: '阿尔及利亚',
  Australia: '澳大利亚',
  Austria: '奥地利',
  Belgium: '比利时',
  Brazil: '巴西',
  Bosnia: '波黑',
  'Bosnia-Herzegovina': '波黑',
  'Bosnia and Herzegovina': '波黑',
  Canada: '加拿大',
  'Cape Verde': '佛得角',
  Colombia: '哥伦比亚',
  Croatia: '克罗地亚',
  'Côte d\'Ivoire': '科特迪瓦',
  "Cote d'Ivoire": '科特迪瓦',
  'Ivory Coast': '科特迪瓦',
  Curacao: '库拉索',
  Curaçao: '库拉索',
  'Czech Republic': '捷克',
  Czechia: '捷克',
  'DR Congo': '刚果金',
  'Democratic Republic of Congo': '刚果金',
  'Congo DR': '刚果金',
  Ecuador: '厄瓜多尔',
  Egypt: '埃及',
  England: '英格兰',
  France: '法国',
  Germany: '德国',
  Ghana: '加纳',
  Haiti: '海地',
  Iran: '伊朗',
  Iraq: '伊拉克',
  Japan: '日本',
  Jordan: '约旦',
  Mexico: '墨西哥',
  Morocco: '摩洛哥',
  Netherlands: '荷兰',
  'New Zealand': '新西兰',
  Norway: '挪威',
  Panama: '巴拿马',
  Paraguay: '巴拉圭',
  Portugal: '葡萄牙',
  Qatar: '卡塔尔',
  'Saudi Arabia': '沙特',
  Scotland: '苏格兰',
  Senegal: '塞内加尔',
  'South Africa': '南非',
  'South Korea': '韩国',
  Korea: '韩国',
  Spain: '西班牙',
  Sweden: '瑞典',
  Switzerland: '瑞士',
  Tunisia: '突尼斯',
  Turkey: '土耳其',
  USA: '美国',
  'United States': '美国',
  Uruguay: '乌拉圭',
  Uzbekistan: '乌兹别克斯坦',
}

export function toChineseTeamName(englishName: string): string {
  return EN_TO_CN[englishName] ?? englishName
}

export function teamMeta(englishName: string) {
  const cn = toChineseTeamName(englishName)
  const info = findTeam(cn)
  return {
    name: cn,
    nameEn: englishName,
    flag: info?.flag ?? '🏳️',
    color: info?.color ?? '#64748b',
    logo: undefined as string | undefined,
  }
}

export function teamMetaFromEspn(displayName: string, logo?: string) {
  const base = teamMeta(displayName)
  return { ...base, logo }
}
