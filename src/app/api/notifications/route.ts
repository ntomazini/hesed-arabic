import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import type { NotifType } from '@prisma/client'

// GET /api/notifications — list notifications + check deadlines
// Query params: ?all=true (sem limite), ?type=TYPE (filtrar por tipo)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const userId = session.user.id
    const role   = session.user.role

    const { searchParams } = new URL(req.url)
    const allNotifs = searchParams.get('all') === 'true'
    const typeFilter = searchParams.get('type')

    // Check approaching deadlines and create notifications if needed
    await checkDeadlines(userId, role)

    const where = {
      userId,
      ...(typeFilter ? { type: typeFilter as NotifType } : {}),
    }

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        ...(allNotifs ? {} : { take: 30 }),
      }),
      db.notification.count({ where: { userId, read: false } }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('[GET /api/notifications]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/notifications]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Check files with deadline < 24h and create notifications if not sent recently
async function checkDeadlines(userId: string, role: string) {
  try {
    if (role === 'GERENTE') return

    const now   = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const since6h = new Date(now.getTime() - 6 * 60 * 60 * 1000)

    const field = role === 'EDITOR' ? 'editorId' : 'revisorId'
    const linkBase = role === 'EDITOR' ? '/editor' : '/revisor'

    const files = await db.projectFile.findMany({
      where: {
        [field]: userId,
        deadline: { lte: in24h, gte: now },
        status: { notIn: ['DONE', 'TRANSLATED'] },
      },
      include: { project: { select: { id: true, name: true } } },
    })

    for (const file of files) {
      const existing = await db.notification.findFirst({
        where: {
          userId,
          type: 'DEADLINE_APPROACHING',
          message: { contains: file.name },
          createdAt: { gte: since6h },
        },
      })
      if (existing) continue

      const hoursLeft = Math.round((file.deadline!.getTime() - now.getTime()) / (1000 * 60 * 60))
      await db.notification.create({
        data: {
          userId,
          type: 'DEADLINE_APPROACHING',
          title: 'Prazo se aproximando',
          message: `"${file.name}" — ${hoursLeft}h restantes (${file.project.name})`,
          link: `${linkBase}/arquivos`,
        },
      })
    }
  } catch {
    // Don't break the main request
  }
}
