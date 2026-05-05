import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Heuristic: short segments (≤ 60 chars, no period at end) are likely headings
function isLikelyHeading(text: string): boolean {
  return text.trim().length <= 60 && !text.trim().endsWith('.')
}

// ── Route ──────────────────────────────────────────────────────────────────────

// GET /api/projects/[id]/files/[fileId]/download?format=docx|txt|html|md
// Returns the translated file as a downloadable attachment.
// ?format overrides the output format; defaults to the original file extension.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const file = await db.projectFile.findUnique({
      where: { id: params.fileId },
      include: { project: true },
    })
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    if (file.projectId !== params.id) {
      return NextResponse.json({ error: 'Arquivo não pertence a este projeto' }, { status: 400 })
    }

    // Access control
    const role   = session.user.role
    const userId = session.user.id
    if (role === 'EDITOR'  && file.editorId  !== userId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    if (role === 'REVISOR' && file.revisorId !== userId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    // Require at least TRANSLATED to allow download
    const downloadable = ['TRANSLATED', 'REVIEWING', 'DONE']
    if (!downloadable.includes(file.status)) {
      return NextResponse.json({ error: 'Arquivo ainda não possui tradução completa para download' }, { status: 400 })
    }

    // Load translated segments in order
    const segments = await db.segment.findMany({
      where: { fileId: params.fileId, targetText: { not: null } },
      orderBy: { order: 'asc' },
    })

    if (segments.length === 0) {
      return NextResponse.json({ error: 'Nenhum segmento traduzido encontrado' }, { status: 404 })
    }

    const originalExt = file.originalName.split('.').pop()?.toLowerCase() ?? 'txt'
    const baseName    = file.originalName.replace(/\.[^.]+$/, '')
    const langSuffix  = file.targetLang.replace('-', '_')

    // ?format param overrides the output format
    const allowedFormats = ['docx', 'txt', 'html', 'md', 'xliff']
    const translations = segments
      .map(s => (s.targetText ?? '').trim())
      .filter(Boolean)

    const requestedFmt   = _req.nextUrl.searchParams.get('format')?.toLowerCase() ?? ''
    const ext            = allowedFormats.includes(requestedFmt) ? requestedFmt : originalExt

    // ── XLIFF export — reconstrói <g> tags a partir do tagMap ───────────────
    if (ext === 'xliff' || ext === 'xlf') {
      type TagEntry = { tag: string; id?: string; attrs?: string }
      function restoreTags(text: string, tagMapJson: string | null): string {
        if (!tagMapJson) return escapeXml(text)
        const map = JSON.parse(tagMapJson) as Record<string, TagEntry>
        // Restore paired tags {N}word{/N}
        let out = text.replace(/\{(\d+)\}([\s\S]*?)\{\/\1\}/g, (_, n, inner) => {
          const info = map[n]
          if (!info) return escapeXml(inner)
          const open = info.id
            ? `<${info.tag} id="${info.id}">`
            : info.attrs ? `<${info.tag} ${info.attrs}>` : `<${info.tag}>`
          return `${open}${escapeXml(inner)}</${info.tag}>`
        })
        // Restore standalone {N} (self-closing)
        out = out.replace(/\{(\d+)\}/g, (_, n) => {
          const info = map[n]
          if (!info) return ''
          return info.id ? `<${info.tag} id="${info.id}"/>` : `<${info.tag}/>`
        })
        return out
      }

      const units = segments.map(seg => {
        const src = restoreTags(seg.sourceText, seg.tagMap as string | null)
        const tgt = restoreTags(seg.targetText ?? '', seg.tagMap as string | null)
        return `    <trans-unit id="${seg.id}">\n      <source xml:space="preserve">${src}</source>\n      <target xml:space="preserve">${tgt}</target>\n    </trans-unit>`
      })

      const xliffContent = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">',
        `  <file datatype="x-plaintext" original="${escapeXml(file.originalName)}" source-language="${file.sourceLang}" target-language="${file.targetLang}">`,
        '    <body>',
        ...units,
        '    </body>',
        '  </file>',
        '</xliff>',
      ].join('\n')

      return new NextResponse(xliffContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/xliff+xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}_${langSuffix}.xliff"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // ── .docx — reconstruct as a real Word document ─────────────────────────
    if (ext === 'docx') {
      const children = translations.map(text => {
        if (isLikelyHeading(text)) {
          return new Paragraph({
            text,
            heading: HeadingLevel.HEADING_2,
          })
        }
        return new Paragraph({
          children: [new TextRun({ text, size: 24, font: 'Calibri' })],
          spacing: { after: 120 },
        })
      })

      const wordDoc = new Document({
        creator: 'Hesed Arabic',
        description: `Tradução de ${file.originalName} para ${file.targetLang}`,
        title: baseName,
        sections: [{ children }],
      })

      const buffer = await Packer.toBuffer(wordDoc)
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${baseName}_${langSuffix}.docx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // ── Other formats ────────────────────────────────────────────────────────
    let content: string
    let mimeType: string
    let downloadName: string

    switch (ext) {
      case 'html':
      case 'htm':
        content = [
          '<!DOCTYPE html>',
          `<html lang="${file.targetLang}">`,
          '<head>',
          '  <meta charset="UTF-8">',
          `  <title>${baseName}</title>`,
          '</head>',
          '<body>',
          ...translations.map(t => `<p>${t}</p>`),
          '</body>',
          '</html>',
        ].join('\n')
        mimeType     = 'text/html; charset=utf-8'
        downloadName = `${baseName}_${langSuffix}.html`
        break

      case 'xml':
        content = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<translation>',
          ...translations.map(t => `  <seg>${escapeXml(t)}</seg>`),
          '</translation>',
        ].join('\n')
        mimeType     = 'application/xml; charset=utf-8'
        downloadName = `${baseName}_${langSuffix}.xml`
        break

      case 'md':
      case 'markdown':
        content      = translations.join('\n\n')
        mimeType     = 'text/markdown; charset=utf-8'
        downloadName = `${baseName}_${langSuffix}.md`
        break

      case 'txt':
      default:
        content      = translations.join('\n\n')
        mimeType     = 'text/plain; charset=utf-8'
        downloadName = `${baseName}_${langSuffix}.txt`
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/:id/files/:fileId/download]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
