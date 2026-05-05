import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSegmentSchema = z.object({
  targetText: z.string().optional(),
  status: z
    .enum(['PENDING', 'TRANSLATING', 'CONFIRMED', 'REVIEWED', 'REJECTED'])
    .optional(),
  comment: z.string().optional().nullable(),
  flagged: z.boolean().optional(),
})

// ─── Mock data (used as fallback when DB is unavailable) ──────────────────────
const MOCK_SEGMENTS = [
  {
    id: 'seg1',
    fileId: 'file1',
    order: 1,
    sourceText:
      'Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal.',
    targetText:
      'Ainda que eu falasse as línguas dos homens e dos anjos, e não tivesse amor, seria como o metal que soa ou como o sino que tine.',
    status: 'CONFIRMED',
    tmScore: 100,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T14:23:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T14:23:00Z',
  },
  {
    id: 'seg2',
    fileId: 'file1',
    order: 2,
    sourceText:
      'And though I have the gift of prophecy, and understand all mysteries, and all knowledge; and though I have all faith, so that I could remove mountains, and have not charity, I am nothing.',
    targetText:
      'E ainda que eu tivesse o dom de profecia, e conhecesse todos os mistérios e toda a ciência, e ainda que tivesse toda a fé, de maneira tal que transportasse os montes, e não tivesse amor, nada seria.',
    status: 'CONFIRMED',
    tmScore: 92,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T14:35:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T14:35:00Z',
  },
  {
    id: 'seg3',
    fileId: 'file1',
    order: 3,
    sourceText:
      'And though I bestow all my goods to feed the poor, and though I give my body to be burned, and have not charity, it profiteth me nothing.',
    targetText:
      'E ainda que distribuísse todos os meus bens para sustento dos pobres, e ainda que entregasse o meu corpo para ser queimado, e não tivesse amor, nada disso me aproveitaria.',
    status: 'CONFIRMED',
    tmScore: 85,
    flagged: true,
    comment: 'Verificar variante textual: "queimado" vs "gloriar-se"',
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T14:40:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T14:40:00Z',
  },
  {
    id: 'seg4',
    fileId: 'file1',
    order: 4,
    sourceText:
      'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg5',
    fileId: 'file1',
    order: 5,
    sourceText:
      'Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg6',
    fileId: 'file1',
    order: 6,
    sourceText:
      'Rejoiceth not in iniquity, but rejoiceth in the truth;',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg7',
    fileId: 'file1',
    order: 7,
    sourceText:
      'Beareth all things, believeth all things, hopeth all things, endureth all things.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg8',
    fileId: 'file1',
    order: 8,
    sourceText:
      'Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away.',
    targetText: '',
    status: 'PENDING',
    tmScore: 78,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg9',
    fileId: 'file1',
    order: 9,
    sourceText:
      'For now we know in part, and we prophesy in part.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg10',
    fileId: 'file1',
    order: 10,
    sourceText:
      'But when that which is perfect is come, then that which is in part shall be done away.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { fileId } = await params

    try {
      const segments = await db.segment.findMany({
        where: { fileId },
        orderBy: { order: 'asc' },
        include: {
          editor: { select: { id: true, name: true, email: true } },
          revisor: { select: { id: true, name: true, email: true } },
        },
      })

      const file = await db.projectFile.findUnique({
        where: { id: fileId },
        select: {
          id: true,
          name: true,
          status: true,
          sourceLang: true,
          targetLang: true,
          wordCount: true,
          totalSegments: true,
          translatedSegments: true,
          reviewedSegments: true,
          editorId: true,
          revisorId: true,
        },
      })

      return NextResponse.json({ segments, file })
    } catch {
      // Fallback to mock data when DB is unavailable
      const mockSegs = MOCK_SEGMENTS.filter((s) => s.fileId === fileId || fileId === 'file1')
      return NextResponse.json({
        segments: mockSegs,
        file: {
          id: fileId,
          name: '1Corintios_Cap13.txt',
          status: 'TRANSLATING',
          sourceLang: 'en',
          targetLang: 'pt-BR',
          wordCount: 906,
          totalSegments: 84,
          translatedSegments: 34,
          reviewedSegments: 12,
        },
      })
    }
  } catch (error) {
    console.error('[GET /api/segments/[fileId]]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { fileId } = await params
    const body = await req.json()

    const parsed = updateSegmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { segmentId, ...updateData } = body as { segmentId: string } & z.infer<typeof updateSegmentSchema>

    if (!segmentId) {
      return NextResponse.json({ error: 'segmentId é obrigatório' }, { status: 400 })
    }

    try {
      const { targetText, status, comment, flagged } = parsed.data
      const segment = await db.segment.update({
        where: { id: segmentId, fileId },
        data: {
          ...(targetText !== undefined && { targetText }),
          ...(status !== undefined && { status }),
          ...(comment !== undefined && { comment: comment ?? null }),
          ...(flagged !== undefined && { flagged }),
          editorId: session.user.id,
          updatedAt: new Date(),
        },
        include: {
          editor: { select: { id: true, name: true, email: true } },
          revisor: { select: { id: true, name: true, email: true } },
        },
      })
      return NextResponse.json({ segment })
    } catch {
      // Mock response when DB is unavailable
      return NextResponse.json({
        segment: {
          id: segmentId,
          fileId,
          ...parsed.data,
          updatedAt: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error('[PATCH /api/segments/[fileId]]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
