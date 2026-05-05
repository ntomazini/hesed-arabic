import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/analytics — aggregated platform analytics for gerente dashboard
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (session.user.role !== 'GERENTE') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // ── 1. Overview ──────────────────────────────────────────────────────────
    const [confirmedAgg, completedFiles, tmCount] = await Promise.all([
      db.segment.aggregate({
        where: { status: { in: ['CONFIRMED', 'REVIEWED'] } },
        _count: { id: true },
        _sum: { wordCount: true },
      }),
      db.projectFile.count({ where: { status: 'DONE' } }),
      db.tMEntry.count(),
    ])

    // ── 2. Editor productivity ────────────────────────────────────────────────
    const editors = await db.user.findMany({
      where: { role: 'EDITOR' },
      select: {
        id: true,
        name: true,
        active: true,
        editorAssignments: {
          select: {
            id: true,
            totalSegments: true,
            confirmedSegments: true,
            wordCount: true,
            status: true,
          },
        },
        segments: {
          where: { status: { in: ['CONFIRMED', 'REVIEWED'] } },
          select: { wordCount: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const editorStats = editors.map(e => {
      const avgProgress = e.editorAssignments.length > 0
        ? Math.round(
            e.editorAssignments.reduce((acc, f) => {
              const pct = f.totalSegments > 0 ? f.confirmedSegments / f.totalSegments : 0
              return acc + pct
            }, 0) / e.editorAssignments.length * 100
          )
        : 0

      return {
        id: e.id,
        name: e.name,
        active: e.active,
        filesCount: e.editorAssignments.length,
        segmentsConfirmed: e.segments.length,
        wordsConfirmed: e.segments.reduce((a, s) => a + s.wordCount, 0),
        avgProgress,
      }
    }).sort((a, b) => b.wordsConfirmed - a.wordsConfirmed)

    // ── 3. Project progress + completion estimates ────────────────────────────
    const projects = await db.project.findMany({
      where: { status: { in: ['ACTIVE', 'COMPLETED', 'PAUSED', 'DRAFT'] } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        files: {
          select: {
            id: true,
            totalSegments: true,
            confirmedSegments: true,
            reviewedSegments: true,
            wordCount: true,
            status: true,
          },
        },
      },
    })

    // Count segments confirmed in the last 7 days, grouped by fileId
    const recentConfirms = await db.segment.groupBy({
      by: ['fileId'],
      where: {
        confirmedAt: { gte: sevenDaysAgo },
        status: { in: ['CONFIRMED', 'REVIEWED'] },
      },
      _count: { id: true },
    })
    const recentByFile: Record<string, number> = {}
    for (const r of recentConfirms) recentByFile[r.fileId] = r._count.id

    const projectStats = projects.map(p => {
      const totalSegs     = p.files.reduce((a, f) => a + f.totalSegments,    0)
      const confirmedSegs = p.files.reduce((a, f) => a + f.confirmedSegments, 0)
      const reviewedSegs  = p.files.reduce((a, f) => a + f.reviewedSegments,  0)
      const words         = p.files.reduce((a, f) => a + f.wordCount,         0)

      const translationProgress = totalSegs > 0 ? Math.round(confirmedSegs / totalSegs * 100) : 0
      const reviewProgress      = totalSegs > 0 ? Math.round(reviewedSegs  / totalSegs * 100) : 0

      // Daily rate = segments confirmed in last 7 days / 7
      const recentTotal = p.files.reduce((a, f) => a + (recentByFile[f.id] ?? 0), 0)
      const dailyRate   = Math.round((recentTotal / 7) * 10) / 10

      let estimatedDaysLeft: number | null = null
      let estimatedCompletionDate: string | null = null

      if (dailyRate > 0 && confirmedSegs < totalSegs && p.status === 'ACTIVE') {
        estimatedDaysLeft = Math.ceil((totalSegs - confirmedSegs) / dailyRate)
        const est = new Date()
        est.setDate(est.getDate() + estimatedDaysLeft)
        estimatedCompletionDate = est.toISOString().split('T')[0]
      }

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        deadline: p.deadline,
        totalSegments: totalSegs,
        confirmedSegments: confirmedSegs,
        translationProgress,
        reviewProgress,
        wordCount: words,
        dailyRate,
        estimatedDaysLeft,
        estimatedCompletionDate,
      }
    })

    // ── 4. TM stats ───────────────────────────────────────────────────────────
    const tmAgg = await db.tMEntry.aggregate({
      _count: { id: true },
      _avg: { quality: true },
      _sum: { usedCount: true },
    })

    return NextResponse.json({
      overview: {
        totalWordsConfirmed: confirmedAgg._sum.wordCount ?? 0,
        totalSegmentsConfirmed: confirmedAgg._count.id,
        totalFilesCompleted: completedFiles,
        tmEntriesCount: tmCount,
      },
      editors: editorStats,
      projects: projectStats,
      tmStats: {
        totalEntries: tmAgg._count.id,
        avgQuality: Math.round(tmAgg._avg.quality ?? 0),
        totalUsed: tmAgg._sum.usedCount ?? 0,
      },
    })
  } catch (error) {
    console.error('[GET /api/analytics]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
