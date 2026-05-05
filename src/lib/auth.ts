import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'

declare module 'next-auth' {
  interface User {
    id: string
    role: Role
    name: string
    email: string
  }

  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: Role
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    name: string
    email: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user) {
          throw new Error('Credenciais inválidas')
        }

        if (!user.active) {
          throw new Error('Usuário desativado. Entre em contato com o gerente.')
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)

        if (!passwordMatch) {
          throw new Error('Credenciais inválidas')
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.name = user.name
        token.email = user.email
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.name = token.name
        session.user.email = token.email
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',  // NextAuth prepends basePath automatically with NEXTAUTH_URL set correctly
  },

  secret: process.env.NEXTAUTH_SECRET,
}

// RBAC helpers
export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole)
}

export function getRoleDashboard(role: Role): string {
  const routes: Record<Role, string> = {
    GERENTE: '/gerente',
    EDITOR: '/editor',
    REVISOR: '/revisor',
  }
  return routes[role]
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    GERENTE: 'Gerente',
    EDITOR: 'Editor',
    REVISOR: 'Revisor',
  }
  return labels[role]
}
