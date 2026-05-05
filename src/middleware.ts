import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { Role } from '@prisma/client'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const role = token.role as Role | undefined

    if (!role) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const dashboardRoutes: Record<Role, string> = {
      GERENTE: '/gerente',
      EDITOR: '/editor',
      REVISOR: '/revisor',
    }

    // Redireciona raiz para dashboard do papel
    if (pathname === '/') {
      return NextResponse.redirect(new URL(dashboardRoutes[role], req.url))
    }

    // Gerente tenta acessar editor/revisor — permite (gerente pode ver tudo)
    // Editor tenta acessar gerente — redireciona
    if (pathname.startsWith('/gerente') && role !== 'GERENTE') {
      return NextResponse.redirect(new URL(dashboardRoutes[role], req.url))
    }

    // Revisor tenta acessar editor — redireciona
    if (pathname.startsWith('/editor') && role === 'REVISOR') {
      return NextResponse.redirect(new URL('/revisor', req.url))
    }

    // Editor tenta acessar revisor — redireciona
    if (pathname.startsWith('/revisor') && role === 'EDITOR') {
      return NextResponse.redirect(new URL('/editor', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    // Protege todas as rotas exceto login, api/auth, arquivos estáticos
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
