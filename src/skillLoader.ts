let skillCache: string | null = null

/** 预测台用：含 JSON 输出约束的完整 skill */
export async function loadSkill(): Promise<string> {
  if (skillCache) return skillCache
  const res = await fetch('/skill.md')
  if (!res.ok) throw new Error('无法加载 skill.md，请确认 public/skill.md 存在')
  skillCache = await res.text()
  return skillCache
}

/** 问答模式用：去掉 JSON 输出章节，避免模型在聊天里吐 JSON */
export function stripSkillForChat(skill: string): string {
  return skill
    .replace(
      /## 三、输出格式[\s\S]*?(?=\n---\s*\n\s*\n## 四、)/,
      `## 三、对话模式说明（当前为聊天问答，非预测台）

- 必须用**自然中文**回答，禁止输出 JSON、禁止 markdown 代码块
- 禁止以 \`{\` 或 \`\`\`json\` 开头
- 用户问预测时，用条目列表写清：对阵、胜平负倾向、参考比分、1~3 条理由
- 多场预测按比赛分段，每场单独列出
- 结构化单场预测请引导用户使用「预测台」

`,
    )
    .replace(
      /你是「绿茵神算」——一个严谨的世界杯比赛预测分析引擎。你必须\*\*只基于本文档提供的资料\*\*进行分析/,
      '你是「绿茵神算」对话助手。你必须**只基于本文档提供的资料**进行分析',
    )
}

export async function loadSkillForChat(): Promise<string> {
  return stripSkillForChat(await loadSkill())
}

export function clearSkillCache() {
  skillCache = null
}
