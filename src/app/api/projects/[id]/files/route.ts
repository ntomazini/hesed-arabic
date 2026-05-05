import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import mammoth from 'mammoth'

// ── Helpers ────────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .trim()
}

// ── Parsers ────────────────────────────────────────────────────────────────────

function parseTxt(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
}

function parseMd(text: string): string[] {
  const segments: string[] = []
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  for (const block of blocks) {
    if (/^#+\s/.test(block)) {
      for (const line of block.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) segments.push(trimmed)
      }
    } else {
      segments.push(block.replace(/\r?\n/g, ' '))
    }
  }
  return segments.filter((s) => s.length > 1)
}

function parseHtml(html: string): ParsedSegment[] {
  const results: ParsedSegment[] = []
  const blockRegex = /<(p|h[1-6]|li|td|th|seg|div)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = blockRegex.exec(html)) !== null) {
    const inner = match[2]
    if (/<(p|h[1-6]|li|td|th|seg|div)/i.test(inner)) continue
    const parsed = extractInlineTags(inner)
    if (parsed.text.length > 1) results.push(parsed)
  }
  return results
}

async function parseDocx(buffer: Buffer): Promise<ParsedSegment[]> {
  const result = await mammoth.convertToHtml({ buffer })
  return parseHtml(result.value)
}

function parseXml(xml: string): ParsedSegment[] {
  const results: ParsedSegment[] = []
  const segRegex = /<(source|seg)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = segRegex.exec(xml)) !== null) {
    const parsed = extractInlineTags(match[2])
    if (parsed.text.length > 1) results.push(parsed)
  }
  if (results.length === 0) return parseHtml(xml)
  return results
}

// ── Inline tag support (XLIFF + HTML) ────────────────────────────────────────

type ParsedSegment = { text: string; tagMap: string | null }
type TagEntry      = { tag: string; id?: string; attrs?: string }

function toSegments(texts: string[]): ParsedSegment[] {
  return texts.map(t => ({ text: t, tagMap: null }))
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'')
}

// Converte inline tags (XLIFF + HTML) em placeholders numerados {1}…{/1}
// Preserva mapa JSON com info suficiente para reconstrução fiel no export
function extractInlineTags(html: string): ParsedSegment {
  const map: Record<string, TagEntry> = {}
  let n = 0
  const reg = (entry: TagEntry) => { n++; map[String(n)] = entry; return n }

  let text = html
    // XLIFF: <g id="...">content</g>
    .replace(/<g\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/g>/gi, (_, id, inner) => {
      const k = reg({ tag: 'g', id })
      return `{${k}}${decodeEntities(inner.replace(/<[^>]+>/g, ''))}{/${k}}`
    })
    // HTML inline formatting (order: more specific first)
    .replace(/<(strong|em|b|i|u|code|sup|sub|mark|s|del|ins)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, (full, tag, attrs) => {
      const inner = decodeEntities(full.replace(/<[^>]+>/g, ''))
      if (!inner.trim()) return inner
      const k = reg({ tag: tag.toLowerCase(), attrs: attrs?.trim() || undefined })
      return `{${k}}${inner}{/${k}}`
    })
    // <span> and <a> (may carry important attributes)
    .replace(/<(span|a)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, (full, tag, attrs) => {
      const inner = decodeEntities(full.replace(/<[^>]+>/g, ''))
      if (!inner.trim()) return inner
      const k = reg({ tag: tag.toLowerCase(), attrs: attrs?.trim() || undefined })
      return `{${k}}${inner}{/${k}}`
    })
    // XLIFF self-closing: <x>, <bx>, <ex>
    .replace(/<(x|bx|ex)\s+id="([^"]*)"[^>]*\/?>/gi, (_, tag, id) => {
      const k = reg({ tag, id }); return `{${k}}`
    })
    // Strip remaining tags and decode
    .replace(/<[^>]+>/g, '')
  text = decodeEntities(text).trim()
  return { text, tagMap: n > 0 ? JSON.stringify(map) : null }
}

// Extrai <source> de cada <trans-unit> com preservação de inline tags
function parseXliff(xml: string): ParsedSegment[] {
  const results: ParsedSegment[] = []
  const unitRegex = /<(?:trans-unit|segment)[^>]*>([\s\S]*?)<\/(?:trans-unit|segment)>/gi
  let unit
  while ((unit = unitRegex.exec(xml)) !== null) {
    const srcMatch = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(unit[1])
    if (!srcMatch) continue
    const parsed = extractInlineTags(srcMatch[1])
    if (parsed.text.length > 1) results.push(parsed)
  }
  if (results.length === 0) return parseXml(xml)
  return results
}

async function parseFile(buffer: Buffer, fileName: string, mimeType: string): Promise<ParsedSegment[]> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const text = buffer.toString('utf-8')
  switch (ext) {
    case 'txt':      return toSegments(parseTxt(text))
    case 'md':
    case 'markdown': return toSegments(parseMd(text))
    case 'html':
    case 'htm':      return parseHtml(text)
    case 'xml':      return parseXml(text)
    case 'xliff':
    case 'xlf':      return parseXliff(text)
    case 'docx':     return parseDocx(buffer)
    default:
      if (mimeType.includes('html')) return parseHtml(text)
      if (mimeType.includes('xml'))  return parseXml(text)
      return toSegments(parseTxt(text))
  }
}

// ── GET — list files in a project ─────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const project = await db.project.findUnique({
      where: { id: params.id },
      include: {
        files: {
          orderBy: { createdAt: 'asc' },
          include: {
            editor:  { select: { id: true, name: true } },
            revisor: { select: { id: true, name: true } },
            _count:  { select: { segments: true } },
          },
        },
      },
    })

    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    if (session.user.role !== 'GERENTE') {
      const isAssigned = project.files.some(
        (f) => f.editorId === session.user.id || f.revisorId === session.user.id
      )
      if (!isAssigned) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    return NextResponse.json({ files: project.files, project: { id: project.id, name: project.name, sourceLang: project.sourceLang, targetLang: project.targetLang } })
  } catch (error) {
    console.error('[GET /api/projects/:id/files]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST — upload and parse a file ────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Apenas gerentes podem fazer upload de arquivos' }, { status: 403 })
    }

    const project = await db.project.findUnique({ where: { id: params.id } })
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const formData = await req.formData()
    const file     = formData.get('file')     as File   | null
    const bookCode = (formData.get('bookCode') as string | null)?.trim().toUpperCase() || null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = ['txt', 'md', 'markdown', 'html', 'htm', 'xml', 'docx', 'xliff', 'xlf']
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: `Formato não suportado. Use: ${allowed.join(', ')}` }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 10 MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let rawSegments: ParsedSegment[] = []
    try {
      rawSegments = await parseFile(buffer, file.name, file.type)
    } catch (parseErr) {
      console.error('[parseFile]', parseErr)
      return NextResponse.json({ error: 'Erro ao processar o arquivo. Verifique o formato.' }, { status: 422 })
    }

    if (rawSegments.length === 0) {
      return NextResponse.json({ error: 'Nenhum segmento encontrado no arquivo.' }, { status: 422 })
    }

    const totalWords = rawSegments.reduce((acc, s) => acc + countWords(s.text), 0)
    const totalChars = rawSegments.reduce((acc, s) => acc + s.text.length, 0)

    const projectFile = await db.projectFile.create({
      data: {
        projectId:    params.id,
        name:         file.name,
        originalName: file.name,
        sourceLang:   project.sourceLang,
        targetLang:   project.targetLang,
        wordCount:    totalWords,
        charCount:    totalChars,
        totalSegments: rawSegments.length,
        bookCode:     bookCode,
        status:       'READY',
      },
    })

    await db.segment.createMany({
      data: rawSegments.map((seg, idx) => ({
        fileId:     projectFile.id,
        order:      idx + 1,
        sourceText: seg.text,
        tagMap:     seg.tagMap,
        wordCount:  countWords(seg.text),
        status:     'PENDING' as const,
      })),
    })

    if (project.status === 'DRAFT') {
      await db.project.update({ where: { id: params.id }, data: { status: 'ACTIVE' } })
    }

    return NextResponse.json({
      file: {
        ...projectFile,
        segmentsCreated: rawSegments.length,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/:id/files]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
