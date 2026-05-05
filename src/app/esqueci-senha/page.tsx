'use client'

import { useState } from 'react'
import { BookOpen, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Informe seu email.')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
    } catch {
      setError('Não foi possível processar a solicitação. Tente novamente.')
    } finally {
      setLoading(false)
    }
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

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Card header */}
            <div className="bg-[#1e3a5f] px-8 py-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                {sent
                  ? <CheckCircle2 className="w-8 h-8 text-white" />
                  : <BookOpen className="w-8 h-8 text-white" />
                }
              </div>
              <h2 className="text-xl font-bold">
                {sent ? 'Email enviado!' : 'Esqueceu a senha?'}
              </h2>
              <p className="text-blue-200 text-sm mt-1">
                {sent
                  ? 'Verifique sua caixa de entrada'
                  : 'Informe seu email para receber o link de redefinição'
                }
              </p>
            </div>

            <div className="px-8 py-8">
              {/* Sucesso */}
              {sent ? (
                <div className="text-center space-y-4">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                    <p className="text-green-800 font-medium text-sm">
                      Se o email <strong>{email}</strong> estiver cadastrado na plataforma,
                      você receberá um link para redefinir sua senha em instantes.
                    </p>
                  </div>
                  <p className="text-slate-500 text-sm">
                    Não recebeu? Verifique a pasta de spam ou tente novamente.
                  </p>
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={() => { setSent(false); setEmail('') }}
                      className="w-full border border-slate-200 text-slate-600 font-medium py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      Tentar com outro email
                    </button>
                    <Link
                      href="/login"
                      className="w-full bg-[#1e3a5f] text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-[#1e40af] transition-colors text-sm text-center"
                    >
                      Voltar para o login
                    </Link>
                  </div>
                </div>
              ) : (
                /* Formulário */
                <form onSubmit={handleSubmit} className="space-y-5">
                  <p className="text-slate-500 text-sm">
                    Digite o email da sua conta. Enviaremos um link válido por{' '}
                    <strong>1 hora</strong> para você criar uma nova senha.
                  </p>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Mail className="inline w-3.5 h-3.5 mr-1 opacity-60" />
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="input-field"
                      autoComplete="email"
                      disabled={loading}
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1e3a5f] hover:bg-[#1e40af] text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</>
                      : 'Enviar link de redefinição'
                    }
                  </button>

                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-[#1e3a5f] transition-colors mt-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para o login
                  </Link>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} Hesed Arabic. Todos os direitos reservados.
          </p>
        </div>
      </main>
    </div>
  )
}
