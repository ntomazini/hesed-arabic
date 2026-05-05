import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { rateLimitUserMutation } from '@/lib/rate-limit'
import { writeAudit } from '@/lib/audit'

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['EDITOR', 'REVISOR', 'GERENTE']).optional(),
  languagePair: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

// PATCH — atualiza usuário
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const limited = await rateLimitUserMutation(session.user.id)
    if (limited) return limited
    const { id } = await params
    const body = await req.json()
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { password, ...rest } = parsed.data
    const updateData: Record<string, unknown> = { ...rest }

    if (password) {
      updateData.password = await bcrypt.hash(password, 12)
    }

    // Fetch current state to detect changes worth auditing
    const before = await db.user.findUnique({
      where: { id },
      select: { role: true, active: true, email: true, name: true },
    })

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        languagePair: true,
        active: true,
        createdAt: true,
      },
    })

    if (before && parsed.data.role && before.role !== parsed.data.role) {
      await writeAudit({
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'USER_ROLE_CHANGED',
        targetId: user.id,
        targetDesc: `${user.name} <${user.email}>`,
        metadata: { from: before.role, to: parsed.data.role },
      })
    }

    if (before && parsed.data.active === true && before.active === false) {
      await writeAudit({
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'USER_REACTIVATED',
        targetId: user.id,
        targetDesc: `${user.name} <${user.email}>`,
      })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[PATCH /api/users/[id]]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — desativa usuário (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const limited = await rateLimitUserMutation(session.user.id)
    if (limited) return limited
    const { id } = await params

    // Não pode desativar a si mesmo
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta' },
        { status: 400 }
      )
    }

    const target = await db.user.update({
      where: { id },
      data: { active: false },
      select: { name: true, email: true },
    })

    await writeAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'USER_DEACTIVATED',
      targetId: id,
      targetDesc: `${target.name} <${target.email}>`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/users/[id]]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
