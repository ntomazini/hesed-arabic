import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/segments/[id]/history — return version history for a segment
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const segment = await db.segment.findUnique({
      where: { id: params.id },
      select: { id: true, fileId: true, file: { select: { editorId: true, revisorId: true, projectId: true } } },
    })
    if (!segment) return NextResponse.json({ error: 'Segmento não encontrado' }, { status: 404 })

    // Access control
    const { role, id: userId } = session.user
    if (role === 'EDITOR'  && segment.file.editorId  !== userId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    if (role === 'REVISOR' && segment.file.revisorId !== userId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const history = await db.segmentHistory.findMany({
      where: { segmentId: params.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('[GET /api/segments/:id/history]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
