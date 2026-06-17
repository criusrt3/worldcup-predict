let skillCache: string | null = null

export async function loadSkill(): Promise<string> {
  if (skillCache) return skillCache
  const res = await fetch('/skill.md')
  if (!res.ok) throw new Error('无法加载 skill.md，请确认 public/skill.md 存在')
  skillCache = await res.text()
  return skillCache
}

export function clearSkillCache() {
  skillCache = null
}
