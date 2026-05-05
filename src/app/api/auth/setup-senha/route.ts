import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { token, password } = parsed.data
    const user = await db.user.findUnique({ where: { setupToken: token } })
    if (!user) {
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
    }
    if (user.setupTokenExp && user.setupTokenExp < new Date()) {
      return NextResponse.json({ error: 'Link expirado. Solicite ao gerente um novo link.' }, { status: 400 })
    }
    const hashed = await bcrypt.hash(password, 12)
    await db.user.update({
      where: { id: user.id },
      data: { password: hashed, setupToken: null, setupTokenExp: null, active: true },
    })
    return NextResponse.json({ ok: true, message: 'Senha definida com sucesso!' })
  } catch (error) {
    console.error('[POST /api/auth/setup-senha]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token não informado' }, { status: 400 })
    const user = await db.user.findUnique({
      where: { setupToken: token },
      select: { name: true, email: true, setupTokenExp: true },
    })
    if (!user) return NextResponse.json({ error: 'Link inválido' }, { status: 400 })
    if (user.setupTokenExp && user.setupTokenExp < new Date()) {
      return NextResponse.json({ error: 'Link expirado' }, { status: 400 })
    }
    return NextResponse.json({ name: user.name, email: user.email })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
