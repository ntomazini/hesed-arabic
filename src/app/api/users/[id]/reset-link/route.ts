import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendEmail, buildSetupSenhaEmail } from '@/lib/email'
import { rateLimitUserMutation } from '@/lib/rate-limit'
import { writeAudit } from '@/lib/audit'
import crypto from 'crypto'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const limited = await rateLimitUserMutation(session.user.id)
    if (limited) return limited
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const setupToken = crypto.randomBytes(32).toString('hex')
    const setupTokenExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

    await db.user.update({
      where: { id },
      data: { setupToken, setupTokenExp, active: false },
    })

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/app'
    const setupLink = `${baseUrl}/setup-senha/${setupToken}`

    // Tenta enviar email
    let emailSent = false
    try {
      const emailContent = buildSetupSenhaEmail(user.name, setupLink)
      const result = await sendEmail({ to: user.email, ...emailContent })
      emailSent = result.method === 'smtp'
    } catch (emailError) {
      console.error('[POST reset-link] Email error (non-fatal):', emailError)
    }

    await writeAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'USER_RESET_LINK_SENT',
      targetId: user.id,
      targetDesc: `${user.name} <${user.email}>`,
      metadata: { emailSent },
    })

    return NextResponse.json({
      emailSent,
      // Só retorna o link direto se o email falhou (para o gerente copiar manualmente)
      setupLink: emailSent ? null : setupLink,
    })
  } catch (error) {
    console.error('[POST /api/users/[id]/reset-link]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
