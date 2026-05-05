import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().optional(),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  deadline: z.string().datetime().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
    const status = searchParams.get('status')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    // Gerente sees all projects; editor/revisor see only assigned ones
    if (session.user.role !== 'GERENTE') {
      where.files = {
        some: {
          OR: [
            { editorId: session.user.id },
            { revisorId: session.user.id },
          ],
        },
      }
    }

    if (status) {
      where.status = status
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          manager: { select: { id: true, name: true } },
          _count: { select: { files: true } },
          files: {
            select: {
              id: true,
              status: true,
              wordCount: true,
              totalSegments: true,
              translatedSegments: true,
              reviewedSegments: true,
            },
          },
        },
      }),
      db.project.count({ where }),
    ])

    // Calculate progress per project
    const projectsWithProgress = projects.map((project) => {
      const totalFiles = project.files.length
      const wordCount = project.files.reduce((acc, f) => acc + f.wordCount, 0)
      const totalSegments = project.files.reduce((acc, f) => acc + f.totalSegments, 0)
      const translatedSegments = project.files.reduce((acc, f) => acc + f.translatedSegments, 0)
      const reviewedSegments = project.files.reduce((acc, f) => acc + f.reviewedSegments, 0)

      const translationProgress =
        totalSegments > 0 ? Math.round((translatedSegments / totalSegments) * 100) : 0
      const reviewProgress =
        totalSegments > 0 ? Math.round((reviewedSegments / totalSegments) * 100) : 0

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        sourceLang: project.sourceLang,
        targetLang: project.targetLang,
        status: project.status,
        deadline: project.deadline,
        manager: project.manager,
        fileCount: totalFiles,
        wordCount,
        translationProgress,
        reviewProgress,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      }
    })

    return NextResponse.json({
      projects: projectsWithProgress,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[GET /api/projects]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Apenas gerentes podem criar projetos' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, description, sourceLang, targetLang, deadline } = parsed.data

    const project = await db.project.create({
      data: {
        name,
        description,
        sourceLang,
        targetLang,
        deadline: deadline ? new Date(deadline) : null,
        managerId: session.user.id,
        status: 'DRAFT',
      },
      include: {
        manager: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
