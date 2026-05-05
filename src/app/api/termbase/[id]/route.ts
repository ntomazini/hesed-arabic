import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  sourceTerm: z.string().min(1).max(500).optional(),
  targetTerm: z.string().min(1).max(500).optional(),
  definition: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  forbidden: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    const term = await db.termbase.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ term })
  } catch (error) {
    console.error('[PATCH /api/termbase/:id]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const { id } = await params
    await db.termbase.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/termbase/:id]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
