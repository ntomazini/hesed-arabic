import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ── PATCH /api/comments/[id] ──────────────────────────────────────────────────
// Alterna o status de resolvido (qualquer usuário autenticado pode resolver)

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const comment = await db.comment.findUnique({ where: { id: params.id } })
    if (!comment) return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })

    const updated = await db.comment.update({
      where: { id: params.id },
      data:  { resolved: !comment.resolved },
      include: { author: { select: { id: true, name: true, role: true } } },
    })

    return NextResponse.json({ comment: updated })
  } catch (error) {
    console.error('[PATCH /api/comments/:id]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── DELETE /api/comments/[id] ─────────────────────────────────────────────────
// Remove o comentário (apenas o próprio autor ou gerente)

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const comment = await db.comment.findUnique({ where: { id: params.id } })
    if (!comment) return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })

    const isOwner   = comment.authorId === session.user.id
    const isGerente = session.user.role === 'GERENTE'
    if (!isOwner && !isGerente) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await db.comment.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/comments/:id]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
