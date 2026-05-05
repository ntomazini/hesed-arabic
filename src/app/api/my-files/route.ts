import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/my-files — returns files assigned to the logged-in editor or revisor
// Groups them by project for easy display
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const userId = session.user.id
    const role = session.user.role

    // Build where clause based on role
    const where =
      role === 'EDITOR'
        ? { editorId: userId }
        : role === 'REVISOR'
        ? { revisorId: userId }
        : {} // GERENTE sees all (not typically used here but safe)

    const files = await db.projectFile.findMany({
      where,
      orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            sourceLang: true,
            targetLang: true,
            status: true,
          },
        },
        editor:  { select: { id: true, name: true } },
        revisor: { select: { id: true, name: true } },
        _count:  { select: { segments: true } },
      },
    })

    // Group by project
    const projectMap = new Map<
      string,
      {
        id: string
        name: string
        sourceLang: string
        targetLang: string
        status: string
        files: typeof files
      }
    >()

    for (const file of files) {
      const pid = file.project.id
      if (!projectMap.has(pid)) {
        projectMap.set(pid, { ...file.project, files: [] })
      }
      projectMap.get(pid)!.files.push(file)
    }

    const projects = Array.from(projectMap.values())

    // Stats
    const totalFiles = files.length
    const inProgress = files.filter(
      (f) => f.status === 'TRANSLATING' || f.status === 'REVIEWING'
    ).length
    const done = files.filter((f) => f.status === 'DONE').length
    const available = files.filter(
      (f) =>
        role === 'REVISOR'
          ? f.status === 'TRANSLATED' || f.status === 'REVIEWING'
          : f.status === 'READY' || f.status === 'TRANSLATING'
    ).length

    return NextResponse.json({
      projects,
      stats: { totalFiles, inProgress, done, available },
    })
  } catch (error) {
    console.error('[GET /api/my-files]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
