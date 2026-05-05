// ── Aquifer Bible API ──────────────────────────────────────────────────────────
// Banco de dados público de conteúdo bíblico traduzido
// API Key gratuita: https://www.aquifer.bible/apiaccess
// Configure: AQUIFER_API_KEY e AQUIFER_API_URL no .env

const BASE = (process.env.AQUIFER_API_URL ?? 'https://api.aquifer.bible').replace(/\/$/, '')
const KEY  = process.env.AQUIFER_API_KEY ?? ''

export const AQUIFER_READY = Boolean(KEY)

// ── Mapeamento de idiomas ─────────────────────────────────────────────────────

const LANG_CODE: Record<string, string> = {
  'pt-BR': 'pt', 'pt': 'pt', 'en': 'en',
  'es': 'es', 'ar': 'ar', 'he': 'he', 'el': 'el',
}

// ── 66 Livros canônicos (códigos USFM) ───────────────────────────────────────

export const BIBLE_BOOKS = [
  // Antigo Testamento
  { code: 'GEN', pt: 'Gênesis',            testament: 'AT' },
  { code: 'EXO', pt: 'Êxodo',              testament: 'AT' },
  { code: 'LEV', pt: 'Levítico',           testament: 'AT' },
  { code: 'NUM', pt: 'Números',            testament: 'AT' },
  { code: 'DEU', pt: 'Deuteronômio',       testament: 'AT' },
  { code: 'JOS', pt: 'Josué',              testament: 'AT' },
  { code: 'JDG', pt: 'Juízes',             testament: 'AT' },
  { code: 'RUT', pt: 'Rute',               testament: 'AT' },
  { code: '1SA', pt: '1 Samuel',           testament: 'AT' },
  { code: '2SA', pt: '2 Samuel',           testament: 'AT' },
  { code: '1KI', pt: '1 Reis',             testament: 'AT' },
  { code: '2KI', pt: '2 Reis',             testament: 'AT' },
  { code: '1CH', pt: '1 Crônicas',         testament: 'AT' },
  { code: '2CH', pt: '2 Crônicas',         testament: 'AT' },
  { code: 'EZR', pt: 'Esdras',             testament: 'AT' },
  { code: 'NEH', pt: 'Neemias',            testament: 'AT' },
  { code: 'EST', pt: 'Ester',              testament: 'AT' },
  { code: 'JOB', pt: 'Jó',                testament: 'AT' },
  { code: 'PSA', pt: 'Salmos',             testament: 'AT' },
  { code: 'PRO', pt: 'Provérbios',         testament: 'AT' },
  { code: 'ECC', pt: 'Eclesiastes',        testament: 'AT' },
  { code: 'SNG', pt: 'Cânticos',           testament: 'AT' },
  { code: 'ISA', pt: 'Isaías',             testament: 'AT' },
  { code: 'JER', pt: 'Jeremias',           testament: 'AT' },
  { code: 'LAM', pt: 'Lamentações',        testament: 'AT' },
  { code: 'EZK', pt: 'Ezequiel',           testament: 'AT' },
  { code: 'DAN', pt: 'Daniel',             testament: 'AT' },
  { code: 'HOS', pt: 'Oséias',             testament: 'AT' },
  { code: 'JOL', pt: 'Joel',               testament: 'AT' },
  { code: 'AMO', pt: 'Amós',               testament: 'AT' },
  { code: 'OBA', pt: 'Obadias',            testament: 'AT' },
  { code: 'JON', pt: 'Jonas',              testament: 'AT' },
  { code: 'MIC', pt: 'Miquéias',           testament: 'AT' },
  { code: 'NAM', pt: 'Naum',               testament: 'AT' },
  { code: 'HAB', pt: 'Habacuque',          testament: 'AT' },
  { code: 'ZEP', pt: 'Sofonias',           testament: 'AT' },
  { code: 'HAG', pt: 'Ageu',               testament: 'AT' },
  { code: 'ZEC', pt: 'Zacarias',           testament: 'AT' },
  { code: 'MAL', pt: 'Malaquias',          testament: 'AT' },
  // Novo Testamento
  { code: 'MAT', pt: 'Mateus',             testament: 'NT' },
  { code: 'MRK', pt: 'Marcos',             testament: 'NT' },
  { code: 'LUK', pt: 'Lucas',              testament: 'NT' },
  { code: 'JHN', pt: 'João',               testament: 'NT' },
  { code: 'ACT', pt: 'Atos',               testament: 'NT' },
  { code: 'ROM', pt: 'Romanos',            testament: 'NT' },
  { code: '1CO', pt: '1 Coríntios',        testament: 'NT' },
  { code: '2CO', pt: '2 Coríntios',        testament: 'NT' },
  { code: 'GAL', pt: 'Gálatas',            testament: 'NT' },
  { code: 'EPH', pt: 'Efésios',            testament: 'NT' },
  { code: 'PHP', pt: 'Filipenses',         testament: 'NT' },
  { code: 'COL', pt: 'Colossenses',        testament: 'NT' },
  { code: '1TH', pt: '1 Tessalonicenses',  testament: 'NT' },
  { code: '2TH', pt: '2 Tessalonicenses',  testament: 'NT' },
  { code: '1TI', pt: '1 Timóteo',          testament: 'NT' },
  { code: '2TI', pt: '2 Timóteo',          testament: 'NT' },
  { code: 'TIT', pt: 'Tito',               testament: 'NT' },
  { code: 'PHM', pt: 'Filemom',            testament: 'NT' },
  { code: 'HEB', pt: 'Hebreus',            testament: 'NT' },
  { code: 'JAS', pt: 'Tiago',              testament: 'NT' },
  { code: '1PE', pt: '1 Pedro',            testament: 'NT' },
  { code: '2PE', pt: '2 Pedro',            testament: 'NT' },
  { code: '1JN', pt: '1 João',             testament: 'NT' },
  { code: '2JN', pt: '2 João',             testament: 'NT' },
  { code: '3JN', pt: '3 João',             testament: 'NT' },
  { code: 'JUD', pt: 'Judas',              testament: 'NT' },
  { code: 'REV', pt: 'Apocalipse',         testament: 'NT' },
] as const

export type BibleBookCode = typeof BIBLE_BOOKS[number]['code']

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  if (!KEY) return null
  try {
    const res = await fetch(url, {
      headers: { 'api-key': KEY },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.warn(`[Aquifer] ${url} → HTTP ${res.status}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.warn('[Aquifer] fetch error:', (err as Error).message)
    return null
  }
}

// ── Bible ID cache ────────────────────────────────────────────────────────────

const bibleIdCache = new Map<string, number | null>()

interface AquiferBible {
  id: number
  name: string
  abbreviation: string
  isLanguageDefault: boolean
}

/**
 * Retorna o ID do Bible padrão para o idioma alvo.
 * Resultado é cacheado em memória por processo.
 */
export async function getDefaultBibleId(targetLang: string): Promise<number | null> {
  const lang = LANG_CODE[targetLang] ?? targetLang
  if (bibleIdCache.has(lang)) return bibleIdCache.get(lang) ?? null

  const bibles = await fetchJson<AquiferBible[]>(`${BASE}/bibles?languageCode=${lang}`)
  if (!bibles?.length) {
    bibleIdCache.set(lang, null)
    return null
  }

  const def = bibles.find(b => b.isLanguageDefault) ?? bibles[0]
  bibleIdCache.set(lang, def.id)
  console.log(`[Aquifer] Bible para "${lang}": id=${def.id} name="${def.name}"`)
  return def.id
}

// ── Verse list cache ──────────────────────────────────────────────────────────

const verseListCache = new Map<string, string[]>()

interface AquiferTexts {
  chapters: {
    number: number
    verses: { number: number; text: string }[]
  }[]
}

/**
 * Retorna lista ordenada de textos de versículos para um livro.
 * Índice 0 = versículo 1 do capítulo 1, e assim por diante.
 * Resultado é cacheado em memória por processo.
 */
export async function fetchVerseList(bibleId: number, bookCode: string): Promise<string[]> {
  const key = `${bibleId}:${bookCode}`
  if (verseListCache.has(key)) return verseListCache.get(key)!

  const data = await fetchJson<AquiferTexts>(`${BASE}/bibles/${bibleId}/texts?BookCode=${bookCode}`)
  if (!data?.chapters) {
    verseListCache.set(key, [])
    return []
  }

  const verses: string[] = []
  for (const ch of data.chapters) {
    const sorted = [...ch.verses].sort((a, b) => a.number - b.number)
    for (const v of sorted) {
      if (v.text?.trim()) verses.push(v.text.trim())
    }
  }

  console.log(`[Aquifer] ${bookCode} carregado: ${verses.length} versículos (bibleId=${bibleId})`)
  verseListCache.set(key, verses)
  return verses
}
