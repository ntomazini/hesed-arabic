import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'

const assignSchema = z.object({
  assignments: z.array(
    z.object({
      fileId: z.string(),
      editorId: z.string().nullable().optional(),
      revisorId: z.string().nullable().optional(),
      deadline: z.string().nullable().optional(),
    })
  ).min(1, 'Selecione ao menos um arquivo'),
})

// POST /api/projects/[id]/assign — batch assign files to editor + revisor
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Apenas gerentes podem fazer atribuições' }, { status: 403 })
    }

    const project = await db.project.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const body = await req.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { assignments } = parsed.data
    const results: Array<{ fileId: string; ok: boolean; error?: string }> = []

    // Track who was newly assigned to notify via email
    const newAssignments: Array<{
      userId: string
      fileName: string
      role: 'EDITOR' | 'REVISOR'
    }> = []

    for (const a of assignments) {
      try {
        // Get current file state to detect new assignments
        const existing = await db.projectFile.findUnique({
          where: { id: a.fileId },
          select: { id: true, name: true, editorId: true, revisorId: true, projectId: true },
        })

        if (!existing || existing.projectId !== params.id) {
          results.push({ fileId: a.fileId, ok: false, error: 'Arquivo não encontrado neste projeto' })
          continue
        }

        // Determine new status
        let newStatus: string | undefined
        const willHaveEditor = a.editorId !== undefined ? a.editorId : existing.editorId
        if (willHaveEditor && a.editorId !== null) {
          newStatus = 'TRANSLATING'
        }

        const updated = await db.projectFile.update({
          where: { id: a.fileId },
          data: {
            ...(a.editorId  !== undefined ? { editorId:  a.editorId  } : {}),
            ...(a.revisorId !== undefined ? { revisorId: a.revisorId } : {}),
            ...(a.deadline  !== undefined ? { deadline:  a.deadline ? new Date(a.deadline) : null } : {}),
            ...(newStatus ? { status: newStatus as 'TRANSLATING' } : {}),
          },
        })

        // Track new editor assignment
        if (a.editorId && a.editorId !== existing.editorId) {
          newAssignments.push({ userId: a.editorId, fileName: existing.name, role: 'EDITOR' })
        }
        // Track new revisor assignment
        if (a.revisorId && a.revisorId !== existing.revisorId) {
          newAssignments.push({ userId: a.revisorId, fileName: existing.name, role: 'REVISOR' })
        }

        results.push({ fileId: a.fileId, ok: true })
      } catch (err) {
        console.error('[assign file]', a.fileId, err)
        results.push({ fileId: a.fileId, ok: false, error: 'Erro ao atualizar' })
      }
    }

    // Send notification emails (non-blocking)
    if (newAssignments.length > 0) {
      const userIds = [...new Set(newAssignments.map(a => a.userId))]
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
      const userMap = Object.fromEntries(users.map(u => [u.id, u]))

      Promise.all(
        newAssignments.map(async (a) => {
          const user = userMap[a.userId]
          if (!user) return
          const roleLabel = a.role === 'EDITOR' ? 'traduzir' : 'revisar'
          const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/app'
          await sendEmail({
            to: user.email,
            subject: `Nova atribuição: ${a.fileName} — ${project.name}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#1e3a5f">Nova atribuição recebida</h2>
                <p>Olá <strong>${user.name}</strong>,</p>
                <p>Você foi designado para <strong>${roleLabel}</strong> o arquivo:</p>
                <div style="background:#f0f5ff;border-radius:8px;padding:12px 16px;margin:16px 0">
                  <strong>${a.fileName}</strong><br>
                  <span style="color:#666;font-size:14px">Projeto: ${project.name}</span>
                </div>
                <a href="${appUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none">
                  Acessar plataforma
                </a>
              </div>
            `,
            text: `Olá ${user.name}, você foi designado para ${roleLabel} o arquivo "${a.fileName}" no projeto "${project.name}". Acesse: ${appUrl}`,
          }).catch((e) => console.error('[assign email]', e))
        })
      ).catch(() => {})
    }

    const succeeded = results.filter(r => r.ok).length
    return NextResponse.json({ ok: true, assigned: succeeded, total: assignments.length, results })
  } catch (error) {
    console.error('[POST /api/projects/:id/assign]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
