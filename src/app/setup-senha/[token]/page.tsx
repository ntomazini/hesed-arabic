'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function SetupSenhaPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string

  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tokenError, setTokenError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    api.get(`/api/auth/setup-senha?token=${token}`)
      .then(r => setUserInfo(r.data))
      .catch(e => setTokenError(e.response?.data?.error || 'Link inválido'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return }
    if (password !== confirm) { toast.error('As senhas não coincidem'); return }
    setSaving(true)
    try {
      await api.post('/api/auth/setup-senha', { token, password })
      setDone(true)
      toast.success('Senha definida com sucesso!')
      setTimeout(() => router.push('/login'), 2500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar senha'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
            <div className="bg-[#1e3a5f] px-8 py-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold">Definir sua senha</h2>
              <p className="text-blue-200 text-sm mt-1">Crie uma senha segura para acessar a plataforma</p>
            </div>

            <div className="px-8 py-8">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              )}

              {!loading && tokenError && (
                <div className="text-center py-6">
                  <p className="text-red-500 font-medium">{tokenError}</p>
                  <p className="text-slate-400 text-sm mt-2">
                    Solicite um novo link na{' '}
                    <a href="/esqueci-senha" className="text-[#1e3a5f] hover:underline">página de recuperação de senha</a>.
                  </p>
                </div>
              )}

              {!loading && done && (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-green-600 font-semibold">Senha definida com sucesso!</p>
                  <p className="text-slate-400 text-sm mt-2">Redirecionando para o login...</p>
                </div>
              )}

              {!loading && !tokenError && !done && userInfo && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600">
                    Olá, <strong>{userInfo.name}</strong>! Defina sua senha para acessar a plataforma com o email <strong>{userInfo.email}</strong>.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nova senha</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        className="input-field pr-10"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar senha</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Repita a senha"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-[#1e3a5f] hover:bg-[#1e40af] text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Definir senha e entrar'}
                  </button>
                </form>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} Hesed Arabic.</p>
        </div>
      </main>
    </div>
  )
}
