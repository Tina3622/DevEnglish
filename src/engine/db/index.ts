// Adapted from qwerty-learner
import Dexie, { type Table } from 'dexie'

// ── Types ─────────────────────────────────────────────────────────

// ---------- Flashcard (新增 — DevEnglish 核心) ----------

export type MasteryLevel = 0 | 1 | 2 | 3 | 4
// 0 = 新词  1 = 见过(1天)  2 = 熟悉(3天)  3 = 掌握(7天)  4 = 精通(21天)

export interface IFlashcard {
  id?:           number           // Dexie auto-increment primary key
  userId?:       string           // Supabase user id，未登录时为 undefined
  supabaseId?:   string           // 云端同步后对应的 Supabase flashcards.id (uuid)
  word:          string
  ipa?:          string           // 音标，e.g. /rɪˈpɒz.ɪ.tər.i/
  partOfSpeech?: string           // e.g. "noun"
  definition:    string           // 中文释义
  example?:      string           // 英文例句
  exampleZh?:    string           // 中文例句
  scene?:        'work' | 'daily' | 'tech' | 'exam' | string
  masteryLevel:  MasteryLevel     // SRS 等级
  nextReviewAt:  number           // Unix timestamp (ms) — 下次复习时间
  reviewCount:   number           // 总复习次数
  createdAt:     number           // Unix timestamp (ms)
  syncedAt?:     number           // 最后一次云端同步时间
}

// ---------- Word typing record (from qwerty-learner RecordDB) ----------

export interface IWordRecord {
  id?:        number
  word:       string
  dict:       string              // 词库 id（e.g. 'dev-work', 'cet4'）或 'flashcard'
  chapter:    number | null       // 章节索引，非章节模式为 null
  timeStamp:  number              // 记录创建时间 (Unix s)
  /** 每个正确击键与上一个的时间差(ms)，可用于计算总用时和 WPM */
  timing:     number[]
  wrongCount: number
  /** 每个字母位置记录的错误按键 */
  mistakes:   LetterMistakes
}

export interface LetterMistakes {
  [letterIndex: number]: string[]
}

// ---------- Chapter record ----------

export interface IChapterRecord {
  id?:                 number
  dict:                string
  chapter:             number | null
  timeStamp:           number       // Unix s
  time:                number       // 本章用时（s）
  correctCount:        number       // 正确击键次数
  wrongCount:          number       // 错误击键次数
  wordCount:           number       // 完成的单词数
  correctWordIndexes:  number[]     // 一次打对（零错误）的单词原始 index 列表
  wordNumber:          number       // 本章单词总数
  wordRecordIds:       number[]     // 关联的 wordRecords 主键列表
}

// ---------- Review session record ----------

export interface IReviewRecord {
  id?:          number
  dict:         string
  index:        number           // 当前练习进度（word index）
  createTime:   number           // Unix s
  isFinished:   boolean
  words:        ReviewWord[]     // SRS 复习词列表（可能含重复，由算法生成）
}

export interface ReviewWord {
  name:    string
  trans:   string[]
  usphone: string
  ukphone: string
}

// ---------- User-created custom dictionary ----------

export interface ICustomDict {
  id?:       number
  dictId:    string              // e.g. 'custom_1716000000000'
  dictName:  string
  words:     CustomWord[]
  createdAt: number              // ms
  updatedAt: number              // ms
}

export interface CustomWord {
  name:  string
  trans: string[]
}

// ── Helper: generate a custom dict id ────────────────────────────

export function generateCustomDictId(): string {
  return `custom_${Date.now()}`
}

// ── Helper: parse pasted word lines into CustomWord[] ────────────

/**
 * Accepts text in any of these formats (one word per line):
 *   word | translation
 *   word , translation
 *   word   translation   (tab-separated)
 */
export function parseCustomWords(input: string): CustomWord[] {
  return input
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,|\t]/).map((s) => s.trim()).filter(Boolean)
      return parts.length >= 2
        ? { name: parts[0].toLowerCase(), trans: [parts.slice(1).join('；')] }
        : { name: parts[0]?.toLowerCase() ?? '', trans: [] }
    })
    .filter((w) => w.name)
}

// ── Database class ────────────────────────────────────────────────

class DevEnglishDB extends Dexie {
  flashcards!:    Table<IFlashcard,     number>
  wordRecords!:   Table<IWordRecord,    number>
  chapterRecords!:Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord,  number>
  customDicts!:   Table<ICustomDict,    number>

  constructor() {
    super('DevEnglishDB')

    this.version(1).stores({
      // flashcards: primary key auto-increment, indexes on userId, nextReviewAt, word
      flashcards:     '++id, userId, nextReviewAt, word, masteryLevel, createdAt, supabaseId',
      // word & chapter records from typing sessions
      wordRecords:    '++id, word, dict, chapter, timeStamp, [dict+chapter]',
      chapterRecords: '++id, dict, chapter, timeStamp, [dict+chapter]',
      // spaced-repetition review sessions
      reviewRecords:  '++id, dict, createTime, isFinished',
      // user-created custom dictionaries
      customDicts:    '++id, dictId, createdAt, updatedAt',
    })
  }
}

export const db = new DevEnglishDB()

// ── Flashcard helpers ─────────────────────────────────────────────

/** Create a new flashcard with sensible defaults */
export function makeFlashcard(
  partial: Pick<IFlashcard, 'word' | 'definition'> & Partial<IFlashcard>,
): IFlashcard {
  const now = Date.now()
  return {
    masteryLevel:  0,
    nextReviewAt:  now,   // due immediately
    reviewCount:   0,
    createdAt:     now,
    ...partial,
  }
}

/**
 * SRS: calculate next review timestamp after a user rating.
 *
 * Intervals:
 *   'easy'   → level += 1, next = now + 2^level days (max 21 days)
 *   'blurry' → level unchanged, next = now + 1 day
 *   'forgot' → level = 0, next = now + 10 minutes
 */
export function calcNextReview(
  card: IFlashcard,
  rating: 'easy' | 'blurry' | 'forgot',
): Pick<IFlashcard, 'masteryLevel' | 'nextReviewAt' | 'reviewCount'> {
  const now = Date.now()
  const DAY = 86_400_000
  const MIN = 60_000

  let level    = card.masteryLevel
  let nextMs   = now

  switch (rating) {
    case 'easy':
      level    = Math.min(4, (level + 1) as MasteryLevel) as MasteryLevel
      nextMs   = now + Math.min(Math.pow(2, level) * DAY, 21 * DAY)
      break
    case 'blurry':
      nextMs   = now + DAY
      break
    case 'forgot':
      level    = 0
      nextMs   = now + 10 * MIN
      break
  }

  return {
    masteryLevel:  level as MasteryLevel,
    nextReviewAt:  nextMs,
    reviewCount:   card.reviewCount + 1,
  }
}

/** Get all cards due for review right now, sorted by urgency */
export async function getDueFlashcards(
  userId?: string,
  limit = 20,
): Promise<IFlashcard[]> {
  const now  = Date.now()
  const base = db.flashcards.where('nextReviewAt').belowOrEqual(now)
  const all  = userId
    ? await base.filter((c) => c.userId === userId).toArray()
    : await base.toArray()

  return all
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, limit)
}

/** Look up a card by word (case-insensitive) */
export async function findFlashcardByWord(
  word: string,
  userId?: string,
): Promise<IFlashcard | undefined> {
  const lower = word.toLowerCase()
  const cards = await db.flashcards
    .where('word')
    .equalsIgnoreCase(lower)
    .toArray()
  return userId ? cards.find((c) => c.userId === userId) : cards[0]
}

// ── Custom dict helpers ───────────────────────────────────────────

export async function saveCustomDict(
  dictId: string,
  dictName: string,
  words: CustomWord[],
): Promise<number> {
  const existing = await db.customDicts
    .where('dictId')
    .equals(dictId)
    .first()

  if (existing?.id != null) {
    await db.customDicts.update(existing.id, {
      words,
      dictName,
      updatedAt: Date.now(),
    })
    return existing.id
  }

  return db.customDicts.add({
    dictId,
    dictName,
    words,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

export const getAllCustomDicts = () => db.customDicts.toArray()

export const deleteCustomDict = (dictId: string) =>
  db.customDicts.where('dictId').equals(dictId).delete()

// ── Typing record helpers ─────────────────────────────────────────

export async function addWordRecord(record: Omit<IWordRecord, 'id'>): Promise<number> {
  return db.wordRecords.add(record as IWordRecord)
}

export async function addChapterRecord(record: Omit<IChapterRecord, 'id'>): Promise<number> {
  return db.chapterRecords.add(record as IChapterRecord)
}

/** Word-level accuracy statistics for a given dict */
export async function getWordStats(dict: string): Promise<{
  word: string
  attempts: number
  avgWrong: number
}[]> {
  const records = await db.wordRecords.where('dict').equals(dict).toArray()
  const map = new Map<string, { total: number; wrong: number }>()

  for (const r of records) {
    const existing = map.get(r.word) ?? { total: 0, wrong: 0 }
    map.set(r.word, {
      total: existing.total + 1,
      wrong: existing.wrong + r.wrongCount,
    })
  }

  return [...map.entries()].map(([word, { total, wrong }]) => ({
    word,
    attempts: total,
    avgWrong: Math.round((wrong / total) * 10) / 10,
  }))
}
