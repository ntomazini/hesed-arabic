import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  sourceTerm: z.string().min(1).max(500),
  targetTerm: z.string().min(1).max(500),
  definition: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  forbidden: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const sourceLang = searchParams.get('sourceLang')
    const targetLang = searchParams.get('targetLang')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (sourceLang) where.sourceLang = sourceLang
    if (targetLang) where.targetLang = targetLang
    if (q) {
      where.OR = [
        { sourceTerm: { contains: q, mode: 'insensitive' } },
        { targetTerm: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [terms, total] = await Promise.all([
      db.termbase.findMany({
        where, skip, take: limit,
        orderBy: { sourceTerm: 'asc' },
      }),
      db.termbase.count({ where }),
    ])

    return NextResponse.json({ terms, total, page, limit })
  } catch (error) {
    console.error('[GET /api/termbase]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const term = await db.termbase.create({ data: parsed.data })
    return NextResponse.json({ term }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/termbase]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
