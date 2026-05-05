'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { Role } from '@prisma/client'

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = session.user.role as Role
      const routes: Record<Role, string> = {
        GERENTE: '/gerente',
        EDITOR: '/editor',
        REVISOR: '/revisor',
      }
      router.replace(routes[role] || '/gerente')
    }
  }, [session, status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Preencha email e senha')
      return
    }

    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error(result.error === 'CredentialsSignin'
          ? 'Email ou senha incorretos'
          : result.error
        )
      } else if (result?.ok) {
        toast.success('Login realizado com sucesso!')
        // Redirect handled by useEffect
      }
    } catch {
      toast.error('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-900" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-[#1e3a5f] font-bold text-lg">HA</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Hesed Arabic</h1>
            <p className="text-blue-200 text-xs">Bíblia EN→AR</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Card header */}
            <div className="bg-[#1e3a5f] px-8 py-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold">Bem-vindo de volta</h2>
              <p className="text-blue-200 text-sm mt-1">Acesse sua conta para continuar</p>
            </div>

            {/* Form */}
            <div className="px-8 py-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="input-field"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field pr-10"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff className="w-4 h-4" />
                        : <Eye className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1e3a5f] hover:bg-[#1e40af] text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-[#1e3a5f] hover:text-[#1e40af] hover:underline transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 mt-6">
            &copy; {new Date().getFullYear()} Hesed Arabic. Todos os direitos reservados.
          </p>
        </div>
      </main>
    </div>
  )
}
