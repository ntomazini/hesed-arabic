import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { rateLimitProjectMutation } from '@/lib/rate-limit'
import { writeAudit } from '@/lib/audit'

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  sourceLang: z.string().min(2).max(10).optional(),
  targetLang: z.string().min(2).max(10).optional(),
  deadline: z.string().datetime().optional().nullable(),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
    .optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const project = await db.project.findUnique({
      where: { id: params.id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        files: {
          orderBy: { createdAt: 'asc' },
          include: {
            editor: { select: { id: true, name: true } },
            revisor: { select: { id: true, name: true } },
            _count: { select: { segments: true, comments: true } },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Access control: non-gerente can only see projects they're assigned to
    if (session.user.role !== 'GERENTE') {
      const isAssigned = project.files.some(
        (f) =>
          f.editorId === session.user.id || f.revisorId === session.user.id
      )
      if (!isAssigned) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
    }

    // Compute overall progress
    const totalSegments = project.files.reduce((acc, f) => acc + f.totalSegments, 0)
    const translatedSegments = project.files.reduce((acc, f) => acc + f.translatedSegments, 0)
    const reviewedSegments = project.files.reduce((acc, f) => acc + f.reviewedSegments, 0)
    const wordCount = project.files.reduce((acc, f) => acc + f.wordCount, 0)

    return NextResponse.json({
      project: {
        ...project,
        wordCount,
        translationProgress:
          totalSegments > 0 ? Math.round((translatedSegments / totalSegments) * 100) : 0,
        reviewProgress:
          totalSegments > 0 ? Math.round((reviewedSegments / totalSegments) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/:id]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'GERENTE') {
      return NextResponse.json(
        { error: 'Apenas gerentes podem editar projetos' },
        { status: 403 }
      )
    }

    const limited = await rateLimitProjectMutation(session.user.id)
    if (limited) return limited
    const body = await req.json()
    const parsed = updateProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.project.findUnique({
      where: { id: params.id },
      select: { id: true, managerId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Garante que apenas o gerente dono pode editar o projeto
    if (existing.managerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Você só pode editar projetos que você mesmo criou' },
        { status: 403 }
      )
    }

    const { deadline, ...rest } = parsed.data

    const updated = await db.project.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(deadline !== undefined
          ? { deadline: deadline ? new Date(deadline) : null }
          : {}),
      },
      include: {
        manager: { select: { id: true, name: true } },
        _count: { select: { files: true } },
      },
    })

    return NextResponse.json({ project: updated })
  } catch (error) {
    console.error('[PATCH /api/projects/:id]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'GERENTE') {
      return NextResponse.json(
        { error: 'Apenas gerentes podem excluir projetos' },
        { status: 403 }
      )
    }

    const limited = await rateLimitProjectMutation(session.user.id)
    if (limited) return limited

    const existing = await db.project.findUnique({
      where: { id: params.id },
      select: { id: true, managerId: true, name: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Garante que apenas o gerente dono do projeto pode deletá-lo
    if (existing.managerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Você só pode excluir projetos que você mesmo criou' },
        { status: 403 }
      )
    }

    await db.project.delete({ where: { id: params.id } })

    await writeAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'PROJECT_DELETED',
      targetId: params.id,
      targetDesc: existing.name,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/projects/:id]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
