import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/projects/[id]/glossary — listar termos do projeto
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const terms = await db.projectGlossaryTerm.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ terms })
  } catch (error) {
    console.error('[GET /api/projects/[id]/glossary]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/projects/[id]/glossary — criar termo
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json() as { sourceTerm: string; targetTerm: string; notes?: string }
    const { sourceTerm, targetTerm, notes } = body

    if (!sourceTerm?.trim() || !targetTerm?.trim()) {
      return NextResponse.json({ error: 'sourceTerm e targetTerm são obrigatórios' }, { status: 400 })
    }

    const term = await db.projectGlossaryTerm.create({
      data: {
        projectId: params.id,
        sourceTerm: sourceTerm.trim(),
        targetTerm: targetTerm.trim(),
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ term }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/[id]/glossary]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
