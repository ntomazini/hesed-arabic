import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { sendEmail, buildSetupSenhaEmail } from '@/lib/email'
import { rateLimitUserMutation } from '@/lib/rate-limit'
import { writeAudit } from '@/lib/audit'

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome precisa ter ao menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').toLowerCase(),
  role: z.enum(['EDITOR', 'REVISOR', 'GERENTE']),
  languagePair: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const users = await db.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        languagePair: true,
        active: true,
        setupTokenExp: true,
        createdAt: true,
        _count: {
          select: {
            editorAssignments: true,
            revisorAssignments: true,
          },
        },
      },
    })
    return NextResponse.json({ users })
  } catch (error) {
    console.error('[GET /api/users]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const limited = await rateLimitUserMutation(session.user.id)
    if (limited) return limited
    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, email, role, languagePair } = parsed.data
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 409 })
    }
    // Generate setup token — user will set their own password via this link
    const setupToken = crypto.randomBytes(32).toString('hex')
    const setupTokenExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    // Placeholder password (user will change via setup link)
    const tempPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
    const user = await db.user.create({
      data: {
        name,
        email,
        password: tempPassword,
        role,
        languagePair: languagePair ?? null,
        active: false, // inactive until user sets password
        setupToken,
        setupTokenExp,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        languagePair: true,
        active: true,
        createdAt: true,
      },
    })
    // Build setup link
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/app'
    const setupLink = `${baseUrl}/setup-senha/${setupToken}`

    // Send email (graceful — if SMTP not configured, just logs)
    let emailSent = false
    try {
      const emailContent = buildSetupSenhaEmail(name, setupLink)
      const result = await sendEmail({ to: email, ...emailContent })
      emailSent = result.method === 'smtp'
    } catch (emailError) {
      console.error('[POST /api/users] Email error (non-fatal):', emailError)
    }

    await writeAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'USER_CREATED',
      targetId: user.id,
      targetDesc: `${user.name} <${user.email}> (${role})`,
    })

    return NextResponse.json({
      user,
      emailSent,
      setupLink: emailSent ? null : setupLink, // só retorna o link se o email falhou (fallback para gerente copiar)
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/users]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
