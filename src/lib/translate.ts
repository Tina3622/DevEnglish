/**
 * DevEnglish — AI 翻译模块
 *
 * 路由策略：
 *   开发环境（VITE_DEEPSEEK_KEY 存在）  → 直接调 DeepSeek，获得三场景例句
 *   生产环境（VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY）
 *                                        → 走 Supabase Edge Function（protect key server-side）
 *                                          Edge Function 仅返回单场景例句；scenarios 字段为 undefined
 *
 * ⚠️  VITE_DEEPSEEK_KEY 只应在 .env.local（本地开发）中存在，
 *     绝不能提交到版本库或出现在生产构建中。
 *     生产构建只需配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
 */

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

/** 三场景例句结构 */
export interface ScenarioItem {
  en: string
  zh: string
}

/** 三场景例句集合 */
export interface ScenarioExamples {
  dev?: ScenarioItem
  daily?: ScenarioItem
  travel?: ScenarioItem
}

export interface TranslateResult {
  /** 英文翻译结果（单词或完整句子） */
  word: string
  /** 音标（仅单词时有） */
  ipa?: string
  /** 词性（单词时如 verb/noun；句子时固定为 sentence） */
  partOfSpeech?: string
  /** 中文释义 / 翻译 */
  definition: string
  /** 当前展示的英文例句 */
  example?: string
  /** 当前展示的例句中文翻译 */
  exampleZh?: string
  /** 三场景例句缓存（仅单词模式有；通过 Edge Function 时为 undefined） */
  scenarios?: ScenarioExamples
  /** 粒度标记：word 单词 / sentence 句子 */
  type: 'word' | 'sentence'
}

/** 判断输入是否为句子（英文按空格数，中文按汉字数） */
function isSentenceInput(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  // 检测是否为中文为主
  const hasChinese = /[一-鿿]/.test(trimmed)
  if (hasChinese) {
    // FIX: 直接计数汉字，不能用 replace().length
    // 错误示例："你好!" → replace 后 "字字!" length=3 > 2 → 错误地判为句子
    const chineseCount = (trimmed.match(/[一-鿿]/g) ?? []).length
    return chineseCount > 2
  }
  // 英文：超过 2 个空格分隔的词即视为句子
  return trimmed.split(/\s+/).length > 2
}

// ── Production path: Supabase Edge Function ──────────────────────────────────

/** 调用 Supabase Edge Function（生产环境，不暴露 API Key） */
async function translateViaEdgeFunction(input: string): Promise<TranslateResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey    = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase 未配置。请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
  }

  // Edge Function requires a valid JWT; if user is not logged in, use anon key as bearer
  const res = await fetch(`${supabaseUrl}/functions/v1/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ text: input }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 402) {
      throw new Error(err.hint || '免费额度已用完，请购买 DevEnglish 解锁无限翻译')
    }
    throw new Error(`翻译服务错误 (${res.status}): ${err.error ?? res.statusText}`)
  }

  const data = await res.json()
  const isSentence = isSentenceInput(input)

  // Edge Function returns: { translation, ipa, definition, example, exampleZh, quotaRemaining }
  return {
    word:        data.translation || input,
    ipa:         data.ipa         || '',
    partOfSpeech: isSentence ? 'sentence' : (data.partOfSpeech || ''),
    definition:  data.definition  || '',
    example:     data.example     || '',
    exampleZh:   data.exampleZh   || '',
    scenarios:   undefined,  // Edge Function does not return multi-scenario data
    type:        isSentence ? 'sentence' : 'word',
  }
}

// ── Dev path: Direct DeepSeek call (VITE_DEEPSEEK_KEY in .env.local only) ────

/** 直接调 DeepSeek（仅开发环境，Key 在 .env.local 中，绝不打包进生产） */
async function translateViaDirect(input: string, apiKey: string): Promise<TranslateResult> {
  const isSentence = isSentenceInput(input)

  const prompt = isSentence
    ? `你是一个专业的英语学习助手。用户输入了一个**完整句子**。

输入: "${input}"

请严格返回 JSON（不要 markdown 代码块），字段如下：
{
  "word": "完整的英文翻译句子，与输入句子粒度一致，绝对不缩写不压缩",
  "definition": "中文翻译（如果输入是中文则填原句；否则填中文翻译）",
  "partOfSpeech": "sentence",
  "ipa": ""
}

⚠️ 核心约束：
- 输入是句子 → word 必须返回**完整的英文翻译句子**，严禁提取关键词、严禁压缩成单词！
- 输入是中文 → word 返回完整英文翻译
- 输入已是英文 → word 返回原句
- 不要加任何解释文字，只返回 JSON`
    : `你是一个专业的英语学习助手。用户输入了一个**单词或短语**。

输入: "${input}"

请返回严格的 JSON 格式（不要 markdown 代码块）：
{
  "word": "原英文单词",
  "ipa": "音标",
  "partOfSpeech": "词性（如 verb/noun/adj/adv 等）",
  "definition": "中文释义",
  "examples": {
    "dev": { "en": "职场/IT 场景的英文例句", "zh": "例句中文翻译" },
    "daily": { "en": "日常生活场景的英文例句", "zh": "例句中文翻译" },
    "travel": { "en": "旅游出国场景的英文例句", "zh": "例句中文翻译" }
  }
}

⚠️ 核心要求：
- examples 必须包含 dev / daily / travel 三个场景，每个场景一个例句
- 每个例句必须真实自然、对应其场景（不要全写程序员梗）
- 如果输入是中文：word 填正确的英文翻译
- 不要加任何解释文字，只返回 JSON`

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a precise JSON-only assistant. Never output markdown. Only output valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 800,
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DeepSeek API 错误 (${res.status}): ${text}`)
  }

  const data   = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim() || ''

  // Strip markdown code blocks if present
  const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '')

  try {
    const result = JSON.parse(jsonStr)

    if (isSentence) {
      return {
        word:        result.word || input,
        ipa:         '',
        partOfSpeech: 'sentence',
        definition:  result.definition || '',
        example:     '',
        exampleZh:   '',
        type:        'sentence' as const,
      }
    }

    // 单词模式：提取三场景例句
    const rawExamples = result.examples || {}
    const scenarios: ScenarioExamples = {
      dev:    rawExamples.dev    ? { en: rawExamples.dev.en    || '', zh: rawExamples.dev.zh    || '' } : undefined,
      daily:  rawExamples.daily  ? { en: rawExamples.daily.en  || '', zh: rawExamples.daily.zh  || '' } : undefined,
      travel: rawExamples.travel ? { en: rawExamples.travel.en || '', zh: rawExamples.travel.zh || '' } : undefined,
    }
    // 默认选中「日常生活」场景作为卡片初始 example
    const defaultScenario = scenarios.daily || scenarios.dev || scenarios.travel

    return {
      word:        result.word        || input,
      ipa:         result.ipa         || '',
      partOfSpeech: result.partOfSpeech || '',
      definition:  result.definition  || '',
      example:     defaultScenario?.en || result.example || input,
      exampleZh:   defaultScenario?.zh || result.exampleZh || '',
      scenarios,
      type: 'word',
    }
  } catch {
    throw new Error(`AI 返回格式异常，请重试。原始响应：${content.slice(0, 200)}`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 智能翻译：输入英文→得中文释义+例句，输入中文→得英文翻译
 *
 * 自动选择路径：
 *   - 开发时若配置了 VITE_DEEPSEEK_KEY → 直接调 DeepSeek（三场景）
 *   - 否则走 Supabase Edge Function（安全，单场景）
 */
export async function translateText(input: string): Promise<TranslateResult> {
  const devKey = import.meta.env.VITE_DEEPSEEK_KEY as string | undefined

  if (devKey) {
    // Dev-only fast path
    return translateViaDirect(input, devKey)
  }

  // Production path — API key stays on the server
  return translateViaEdgeFunction(input)
}
