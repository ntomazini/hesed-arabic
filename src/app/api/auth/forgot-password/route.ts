import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, buildResetSenhaEmail } from '@/lib/email'
import crypto from 'crypto'

// POST /api/auth/forgot-password
// Público — o usuário informa o email e recebe um link para redefinir a senha
// Por segurança, sempre responde com sucesso (não revela se o email existe)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string }
    const email = body.email?.trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Buscar usuário pelo email
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, active: true },
    })

    // Se não encontrou ou está inativo, responde com "ok" mesmo assim
    // (não revela se o email existe — boa prática de segurança)
    if (!user || !user.active) {
      return NextResponse.json({ ok: true })
    }

    // Gera token de redefinição válido por 1 hora
    const resetToken  = crypto.randomBytes(32).toString('hex')
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await db.user.update({
      where: { id: user.id },
      data: {
        setupToken:    resetToken,
        setupTokenExp: resetExpiry,
        // NÃO desativa a conta — o usuário pode continuar logando com a senha atual
      },
    })

    const baseUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/app'
    const resetLink = `${baseUrl}/setup-senha/${resetToken}`

    // Envia email (fire-and-forget — não bloqueia a resposta)
    sendEmail({
      to: user.email,
      ...buildResetSenhaEmail(user.name, resetLink),
    }).catch(err => console.error('[forgot-password] Email error:', err))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/auth/forgot-password]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
