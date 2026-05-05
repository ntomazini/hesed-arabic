import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE /api/projects/[id]/glossary/[termId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; termId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await db.projectGlossaryTerm.delete({
      where: { id: params.termId, projectId: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/projects/[id]/glossary/[termId]]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
