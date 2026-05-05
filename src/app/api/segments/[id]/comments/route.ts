import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ── GET /api/segments/[id]/comments ──────────────────────────────────────────
// Lista todos os comentários de um segmento (ordenados do mais antigo ao mais novo)

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const comments = await db.comment.findMany({
      where:   { segmentId: params.id },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('[GET /api/segments/:id/comments]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST /api/segments/[id]/comments ─────────────────────────────────────────
// Cria um novo comentário no segmento

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json() as { content: string }
    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Comentário vazio' }, { status: 400 })
    }

    // Verifica se o segmento existe
    const segment = await db.segment.findUnique({
      where:   { id: params.id },
      select:  { id: true, fileId: true },
    })
    if (!segment) return NextResponse.json({ error: 'Segmento não encontrado' }, { status: 404 })

    const comment = await db.comment.create({
      data: {
        content:   body.content.trim(),
        authorId:  session.user.id,
        segmentId: params.id,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/segments/:id/comments]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
