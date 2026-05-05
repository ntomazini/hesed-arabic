import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

// ── GET — get file details + segments ─────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
    const skip = (page - 1) * limit

    const file = await db.projectFile.findUnique({
      where: { id: params.fileId },
      include: {
        project: { select: { id: true, name: true, sourceLang: true, targetLang: true } },
        editor:  { select: { id: true, name: true } },
        revisor: { select: { id: true, name: true } },
      },
    })

    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    if (file.projectId !== params.id) return NextResponse.json({ error: 'Arquivo não pertence a este projeto' }, { status: 400 })

    // Access control
    if (session.user.role === 'EDITOR' && file.editorId !== session.user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (session.user.role === 'REVISOR' && file.revisorId !== session.user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const [segments, total] = await Promise.all([
      db.segment.findMany({
        where: { fileId: params.fileId },
        orderBy: { order: 'asc' },
        skip,
        take: limit,
      }),
      db.segment.count({ where: { fileId: params.fileId } }),
    ])

    return NextResponse.json({ file, segments, total, page, limit })
  } catch (error) {
    console.error('[GET /api/projects/:id/files/:fileId]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── DELETE — remove a file and all its segments ───────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Apenas gerentes podem remover arquivos' }, { status: 403 })
    }

    const file = await db.projectFile.findUnique({ where: { id: params.fileId } })
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    if (file.projectId !== params.id) return NextResponse.json({ error: 'Arquivo não pertence a este projeto' }, { status: 400 })

    // Cascade delete (segments deleted automatically via Prisma onDelete: Cascade)
    await db.projectFile.delete({ where: { id: params.fileId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/projects/:id/files/:fileId]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── PATCH — update file metadata (assign editor/revisor, change status, deadline) ─

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const file = await db.projectFile.findUnique({
      where: { id: params.fileId },
      include: { project: { select: { id: true, name: true, managerId: true } } },
    })
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    if (file.projectId !== params.id) return NextResponse.json({ error: 'Arquivo não pertence a este projeto' }, { status: 400 })

    const body = await req.json() as {
      editorId?: string | null
      revisorId?: string | null
      status?: string
      deadline?: string | null
    }

    const role = session.user.role
    const userId = session.user.id

    // Editors can submit their assigned file for review
    if (role === 'EDITOR') {
      if (file.editorId !== userId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
      if (body.status !== 'TRANSLATED') {
        return NextResponse.json({ error: 'Editores só podem enviar arquivos para revisão' }, { status: 403 })
      }
      const updated = await db.projectFile.update({
        where: { id: params.fileId },
        data: { status: 'TRANSLATED' },
      })

      // Notify revisor that file is ready for review
      if (file.revisorId) {
        await createNotification({
          userId: file.revisorId,
          type: 'FILE_TO_REVIEW',
          title: 'Arquivo para revisar',
          message: `"${file.name}" está pronto para revisão (${file.project.name})`,
          link: `/revisor/projetos/${file.project.id}/arquivos/${file.id}`,
        })
      }

      return NextResponse.json({ file: updated })
    }

    // Revisors can mark their assigned file as done
    if (role === 'REVISOR') {
      if (file.revisorId !== userId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
      if (body.status !== 'DONE' && body.status !== 'REVIEWING') {
        return NextResponse.json({ error: 'Revisores só podem concluir a revisão' }, { status: 403 })
      }
      const updated = await db.projectFile.update({
        where: { id: params.fileId },
        data: { status: body.status as 'REVIEWING' | 'DONE' },
      })

      if (body.status === 'DONE') {
        // Notify project manager that file is done
        await createNotification({
          userId: file.project.managerId,
          type: 'FILE_DONE',
          title: 'Arquivo concluído',
          message: `"${file.name}" foi revisado e concluído (${file.project.name})`,
          link: `/gerente/projetos/${file.project.id}`,
        })

        // Check if all files in project are DONE → COMPLETED
        const allFiles = await db.projectFile.findMany({
          where: { projectId: file.projectId },
          select: { status: true },
        })
        const allDone = allFiles.length > 0 && allFiles.every(f => f.status === 'DONE')
        if (allDone) {
          await db.project.update({ where: { id: file.projectId }, data: { status: 'COMPLETED' } })
          await createNotification({
            userId: file.project.managerId,
            type: 'PROJECT_COMPLETED',
            title: 'Projeto concluído!',
            message: `Todos os arquivos de "${file.project.name}" foram concluídos`,
            link: `/gerente/projetos/${file.project.id}`,
          })
        }
      }

      return NextResponse.json({ file: updated })
    }

    // Only gerentes can do full updates (assign, deadline, etc.)
    if (role !== 'GERENTE') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const updated = await db.projectFile.update({
      where: { id: params.fileId },
      data: {
        ...(body.editorId  !== undefined ? { editorId: body.editorId }   : {}),
        ...(body.revisorId !== undefined ? { revisorId: body.revisorId } : {}),
        ...(body.status    !== undefined ? { status: body.status as 'READY' | 'TRANSLATING' | 'TRANSLATED' | 'REVIEWING' | 'DONE' | 'REJECTED' } : {}),
        ...(body.deadline  !== undefined ? { deadline: body.deadline ? new Date(body.deadline) : null } : {}),
      },
      include: {
        editor:  { select: { id: true, name: true } },
        revisor: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ file: updated })
  } catch (error) {
    console.error('[PATCH /api/projects/:id/files/:fileId]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
