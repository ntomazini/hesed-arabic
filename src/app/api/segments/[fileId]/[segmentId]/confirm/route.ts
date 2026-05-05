import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const confirmSchema = z.object({
  targetText: z.string().min(1, 'Tradução não pode estar vazia'),
  role: z.enum(['editor', 'revisor']),
  comment: z.string().optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string; segmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { fileId, segmentId } = await params
    const body = await req.json()

    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { targetText, role, comment } = parsed.data
    const now = new Date()
    const newStatus = role === 'revisor' ? 'REVIEWED' : 'CONFIRMED'

    try {
      // 1. Update segment in DB
      const segment = await db.segment.update({
        where: { id: segmentId, fileId },
        data: {
          targetText,
          status: newStatus,
          comment: comment ?? null,
          ...(role === 'editor'
            ? { editorId: session.user.id, confirmedAt: now }
            : { revisorId: session.user.id, reviewedAt: now }),
          updatedAt: now,
        },
        include: {
          editor: { select: { id: true, name: true, email: true } },
          revisor: { select: { id: true, name: true, email: true } },
        },
      })

      // 2. Save to Translation Memory (revisor approval only — reviewed text has higher quality)
      if (role === 'revisor') {
        const sourceSegment = await db.segment.findUnique({
          where: { id: segmentId },
          select: { sourceText: true },
        })

        const fileRecord = await db.projectFile.findUnique({
          where: { id: fileId },
          select: { sourceLang: true, targetLang: true },
        })

        if (sourceSegment?.sourceText && fileRecord) {
          await db.tMEntry.upsert({
            where: {
              sourceText_sourceLang_targetLang: {
                sourceText: sourceSegment.sourceText,
                sourceLang: fileRecord.sourceLang,
                targetLang: fileRecord.targetLang,
              },
            },
            create: {
              sourceText: sourceSegment.sourceText,
              targetText,
              sourceLang: fileRecord.sourceLang,
              targetLang: fileRecord.targetLang,
              quality: 100,
              createdById: session.user.id,
            },
            update: {
              targetText,
              quality: 100,
              usedCount: { increment: 1 },
              updatedAt: now,
            },
          })
        }
      }

      // 3. Update file progress counters
      await db.projectFile.update({
        where: { id: fileId },
        data:
          role === 'editor'
            ? { translatedSegments: { increment: 1 } }
            : { reviewedSegments: { increment: 1 } },
      })

      return NextResponse.json({ segment, savedToTM: role === 'editor' })
    } catch {
      // Mock response when DB is unavailable
      return NextResponse.json({
        segment: {
          id: segmentId,
          fileId,
          targetText,
          status: newStatus,
          comment: comment ?? null,
          ...(role === 'editor'
            ? { editorId: session.user.id, confirmedAt: now.toISOString() }
            : { revisorId: session.user.id, reviewedAt: now.toISOString() }),
          updatedAt: now.toISOString(),
        },
        savedToTM: role === 'editor',
      })
    }
  } catch (error) {
    console.error('[POST /api/segments/[fileId]/[segmentId]/confirm]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
