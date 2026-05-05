import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

// PATCH /api/segments/[id] — save translation + update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const segment = await db.segment.findUnique({
      where: { id: params.id },
      include: { file: { include: { project: true } } },
    })
    if (!segment) return NextResponse.json({ error: 'Segmento não encontrado' }, { status: 404 })

    // Access control
    const role = session.user.role
    const userId = session.user.id
    if (role === 'EDITOR' && segment.file.editorId !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (role === 'REVISOR' && segment.file.revisorId !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json() as {
      targetText?: string
      status?: string
      note?: string
      flagged?: boolean
    }

    // Determine new status automatically if not provided
    let newStatus = body.status
    if (!newStatus && body.targetText !== undefined) {
      if (role === 'REVISOR') {
        newStatus = 'REVIEWED'
      } else {
        newStatus = body.targetText.trim() ? 'CONFIRMED' : 'TRANSLATING'
      }
    }

    const now = new Date()
    const updated = await db.segment.update({
      where: { id: params.id },
      data: {
        ...(body.targetText !== undefined ? { targetText: body.targetText } : {}),
        ...(newStatus ? { status: newStatus as 'PENDING' | 'TRANSLATING' | 'CONFIRMED' | 'REVIEWED' | 'REJECTED' } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.flagged !== undefined ? { flagged: body.flagged } : {}),
        ...(role === 'EDITOR' && newStatus === 'CONFIRMED' ? { editorId: userId, confirmedAt: now } : {}),
        ...(role === 'REVISOR' && (newStatus === 'REVIEWED') ? { revisorId: userId, reviewedAt: now } : {}),
      },
    })

    // Record history when text or status changes meaningfully
    if (body.targetText !== undefined || (newStatus && ['CONFIRMED','REVIEWED','REJECTED'].includes(newStatus))) {
      await db.segmentHistory.create({
        data: {
          segmentId: params.id,
          targetText: updated.targetText,
          status: updated.status,
          authorName: session.user.name,
          authorRole: role,
        },
      }).catch(() => {}) // never break main flow
    }

    // Save to TM when revisor approves (reviewed text has guaranteed quality)
    if (role === 'REVISOR' && newStatus === 'REVIEWED' && updated.targetText && updated.sourceText) {
      const { sourceLang, targetLang } = segment.file
      await db.tMEntry.upsert({
        where: {
          sourceText_sourceLang_targetLang: {
            sourceText: updated.sourceText,
            sourceLang,
            targetLang,
          },
        },
        create: {
          sourceText:  updated.sourceText,
          targetText:  updated.targetText,
          sourceLang,
          targetLang,
          quality:     100,
          createdById: userId,
        },
        update: {
          targetText:  updated.targetText,
          quality:     100,
          usedCount:   { increment: 1 },
          updatedAt:   now,
        },
      }).catch(() => {}) // nunca quebra o fluxo principal
    }

    // Notify editor when revisor rejects a segment
    if (role === 'REVISOR' && newStatus === 'REJECTED' && segment.file.editorId) {
      await createNotification({
        userId: segment.file.editorId,
        type: 'SEGMENT_REJECTED',
        title: 'Segmento rejeitado',
        message: `Revisor rejeitou um segmento em "${segment.file.name}" (${segment.file.project.name})`,
        link: `/editor/projetos/${segment.file.project.id}/arquivos/${segment.fileId}`,
      })
    }

    // Update file progress counters
    await updateFileProgress(segment.fileId)

    // ── Auto-propagação ───────────────────────────────────────────────────────
    // When an editor confirms a segment, find identical source segments in the
    // same file that are still pending/translating and propagate the translation.
    let propagatedCount = 0
    let propagatedIds: string[] = []

    if (role === 'EDITOR' && newStatus === 'CONFIRMED' && body.targetText?.trim()) {
      const toPropagate = await db.segment.findMany({
        where: {
          fileId: segment.fileId,
          sourceText: segment.sourceText,
          id: { not: params.id },
          status: { in: ['PENDING', 'TRANSLATING'] },
        },
        select: { id: true },
      })

      if (toPropagate.length > 0) {
        propagatedIds = toPropagate.map(s => s.id)
        await db.segment.updateMany({
          where: { id: { in: propagatedIds } },
          data: {
            targetText: body.targetText,
            status: 'CONFIRMED',
            editorId: userId,
            confirmedAt: now,
          },
        })
        propagatedCount = propagatedIds.length
        // Recount file progress to include propagated segments
        await updateFileProgress(segment.fileId)
      }
    }

    return NextResponse.json({ segment: updated, propagated: propagatedCount, propagatedIds })
  } catch (error) {
    console.error('[PATCH /api/segments/:id]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Helper — recount segment statuses and update ProjectFile counters
async function updateFileProgress(fileId: string) {
  const counts = await db.segment.groupBy({
    by: ['status'],
    where: { fileId },
    _count: { _all: true },
  })

  const countMap: Record<string, number> = {}
  for (const c of counts) countMap[c.status] = c._count._all

  const total       = Object.values(countMap).reduce((a, b) => a + b, 0)
  const translated  = (countMap['CONFIRMED'] ?? 0) + (countMap['REVIEWED'] ?? 0)
  const confirmed   = (countMap['CONFIRMED'] ?? 0) + (countMap['REVIEWED'] ?? 0)
  const reviewed    = countMap['REVIEWED'] ?? 0

  // Determine file status
  let fileStatus: string | undefined
  if (reviewed === total && total > 0) fileStatus = 'DONE'
  else if (confirmed > 0 && confirmed === total) fileStatus = 'TRANSLATED'
  else if (translated > 0) fileStatus = 'TRANSLATING'

  await db.projectFile.update({
    where: { id: fileId },
    data: {
      translatedSegments: translated,
      confirmedSegments: confirmed,
      reviewedSegments: reviewed,
      ...(fileStatus ? { status: fileStatus as 'TRANSLATING' | 'TRANSLATED' | 'REVIEWING' | 'DONE' } : {}),
    },
  })

  // If all segments reviewed → file is DONE → check if project is now fully COMPLETED
  if (fileStatus === 'DONE') {
    const record = await db.projectFile.findUnique({ where: { id: fileId }, select: { projectId: true } })
    if (record) {
      const allFiles = await db.projectFile.findMany({
        where: { projectId: record.projectId },
        select: { status: true },
      })
      if (allFiles.length > 0 && allFiles.every(f => f.status === 'DONE')) {
        await db.project.update({ where: { id: record.projectId }, data: { status: 'COMPLETED' } })
      }
    }
  }
}
