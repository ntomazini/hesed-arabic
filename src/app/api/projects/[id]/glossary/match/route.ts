import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/projects/[id]/glossary/match?text=...
// Retorna os termos do projeto cujo sourceTerm aparece no texto (case-insensitive)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const text = new URL(req.url).searchParams.get('text') ?? ''

    // Busca todos os termos do projeto e filtra no JS (tabela pequena)
    const allTerms = await db.projectGlossaryTerm.findMany({
      where: { projectId: params.id },
      orderBy: { sourceTerm: 'asc' },
    })

    const lower = text.toLowerCase()
    const matches = allTerms.filter(t =>
      lower.includes(t.sourceTerm.toLowerCase())
    )

    return NextResponse.json({ terms: matches })
  } catch (error) {
    console.error('[GET /api/projects/[id]/glossary/match]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
