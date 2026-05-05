'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Users, UserPlus, Mail, User, Globe,
  CheckCircle2, XCircle, Pencil, Loader2,
  Shield, Copy, Link2, RefreshCw,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

type Role = 'EDITOR' | 'REVISOR' | 'GERENTE'

interface UserItem {
  id: string
  name: string
  email: string
  role: Role
  languagePair: string | null
  active: boolean
  setupToken: string | null
  createdAt: string
  _count: { editorAssignments: number; revisorAssignments: number }
}

const LANG_PAIRS = [
  { value: 'EN_PT', label: 'EN → PT-BR' },
  { value: 'EN_ES', label: 'EN → ES' },
  { value: 'ES_PT', label: 'ES → PT-BR' },
  { value: 'PT_EN', label: 'PT → EN' },
  { value: 'EN_AR', label: 'EN → AR' },
]

const ROLE_COLORS: Record<Role, string> = {
  GERENTE: 'bg-purple-100 text-purple-700',
  EDITOR: 'bg-blue-100 text-blue-700',
  REVISOR: 'bg-teal-100 text-teal-700',
}
const ROLE_LABELS: Record<Role, string> = {
  GERENTE: 'Gerente', EDITOR: 'Editor', REVISOR: 'Revisor',
}

interface FormState { name: string; email: string; role: Role; languagePair: string }
const EMPTY_FORM: FormState = { name: '', email: '', role: 'EDITOR', languagePair: 'EN_PT' }

function getSetupLink(token: string) {
  const base = window.location.origin
  return `${base}/app/setup-senha/${token}`
}

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [filterRole, setFilterRole] = useState<Role | 'TODOS'>('TODOS')
  const [setupLink, setSetupLink] = useState<{ name: string; link: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users')
      return data.users as UserItem[]
    },
  })
  const users = data ?? []

  const createMutation = useMutation({
    mutationFn: (body: FormState) => api.post('/api/users', body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
      const { user, setupToken, emailSent } = res.data
      if (emailSent) {
        toast.success(`Email enviado para ${user.email}!`)
      }
      setSetupLink({ name: user.name, link: getSetupLink(setupToken) })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar usuário'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<FormState> | Record<string, string> }) => api.patch(`/api/users/${id}`, body),
    onSuccess: () => {
      toast.success('Usuário atualizado!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao atualizar'
      toast.error(msg)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/api/users/${id}`, { active }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Status atualizado!') },
  })

  // Regenerate setup link
  const resetLinkMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/users/${id}/reset-link`),
    onSuccess: (res, id) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      const u = users.find(u => u.id === id)
      setSetupLink({ name: u?.name ?? '', link: getSetupLink(res.data.setupToken) })
    },
    onError: () => toast.error('Erro ao gerar novo link'),
  })

  function openCreate() { setEditingUser(null); setForm(EMPTY_FORM); setShowModal(true) }
  function openEdit(u: UserItem) {
    setEditingUser(u)
    setForm({ name: u.name, email: u.email, role: u.role, languagePair: u.languagePair ?? 'EN_PT' })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditingUser(null); setForm(EMPTY_FORM) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, body: { name: form.name, role: form.role, languagePair: form.languagePair } })
    } else {
      createMutation.mutate(form)
    }
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link).then(() => toast.success('Link copiado!'))
  }

  const filtered = filterRole === 'TODOS' ? users : users.filter(u => u.role === filterRole)
  const isBusy = createMutation.isPending || updateMutation.isPending

  const summary = {
    total: users.length,
    editores: users.filter(u => u.role === 'EDITOR').length,
    revisores: users.filter(u => u.role === 'REVISOR').length,
    gerentes: users.filter(u => u.role === 'GERENTE').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Usuários</h2>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie editores, revisores e gerentes da plataforma.</p>
        </div>
        <Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={openCreate}>
          Novo Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: summary.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Editores', value: summary.editores, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Revisores', value: summary.revisores, color: 'text-teal-700', bg: 'bg-teal-50' },
          { label: 'Gerentes', value: summary.gerentes, color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={clsx('rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3', s.bg)}>
            <Users className={clsx('w-5 h-5', s.color)} />
            <div>
              <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['TODOS', 'EDITOR', 'REVISOR', 'GERENTE'] as const).map(r => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              filterRole === r ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {r === 'TODOS' ? 'Todos' : r === 'EDITOR' ? 'Editores' : r === 'REVISOR' ? 'Revisores' : 'Gerentes'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum usuário encontrado</p>
            <button onClick={openCreate} className="mt-3 text-[#1e3a5f] text-sm font-medium hover:underline">Criar primeiro usuário</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Função</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Par de idiomas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(u => (
                  <tr key={u.id} className={clsx('hover:bg-slate-50/50 transition-colors', !u.active && 'opacity-60')}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#1e3a5f] text-xs font-bold">
                            {u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold', ROLE_COLORS[u.role])}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600 text-xs font-mono">
                      {LANG_PAIRS.find(p => p.value === u.languagePair)?.label ?? u.languagePair ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      {u.active ? (
                        <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />Ativo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-500 text-xs font-medium">
                          <Mail className="w-3.5 h-3.5" />Aguardando ativação
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.setupToken && (
                          <button onClick={() => setSetupLink({ name: u.name, link: getSetupLink(u.setupToken!) })}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver link de acesso">
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => resetLinkMutation.mutate(u.id)}
                          className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Gerar novo link">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        {u.active && (
                          <button onClick={() => toggleMutation.mutate({ id: u.id, active: false })}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Desativar">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!u.active && u.setupToken === null && (
                          <button onClick={() => toggleMutation.mutate({ id: u.id, active: true })}
                            className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Ativar">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md">
            <div className="bg-[#1e3a5f] rounded-t-2xl px-6 py-5 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                {editingUser ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-lg">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                <p className="text-blue-200 text-sm">
                  {editingUser ? `Editando: ${editingUser.name}` : 'Um link de acesso será gerado automaticamente'}
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <User className="inline w-3.5 h-3.5 mr-1 opacity-60" />Nome completo
                </label>
                <input type="text" className="input-field" placeholder="Ex: Ana Luiza Silva"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Mail className="inline w-3.5 h-3.5 mr-1 opacity-60" />Email
                  </label>
                  <input type="email" className="input-field" placeholder="usuario@email.com"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Shield className="inline w-3.5 h-3.5 mr-1 opacity-60" />Função
                  </label>
                  <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
                    <option value="EDITOR">Editor</option>
                    <option value="REVISOR">Revisor</option>
                    <option value="GERENTE">Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Globe className="inline w-3.5 h-3.5 mr-1 opacity-60" />Par de idiomas
                  </label>
                  <select className="input-field" value={form.languagePair} onChange={e => setForm({ ...form, languagePair: e.target.value })}>
                    {LANG_PAIRS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              {!editingUser && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
                  <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Após criar, você receberá um <strong>link de acesso</strong> para enviar ao usuário. Ele definirá a própria senha.</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal} disabled={isBusy}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" loading={isBusy}>
                  {editingUser ? 'Salvar alterações' : 'Criar usuário'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Setup Link Modal */}
      {setupLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Usuário criado!</h3>
                <p className="text-sm text-slate-500">Envie o link abaixo para <strong>{setupLink.name}</strong></p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              O usuário deve clicar neste link para definir sua senha e ativar o acesso:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <a
                href={setupLink.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline break-all flex-1"
              >
                {setupLink.link}
              </a>
              <button onClick={() => copyLink(setupLink.link)}
                className="flex-shrink-0 p-2 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-200 rounded-lg transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">Link válido por 7 dias.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => copyLink(setupLink.link)}
                className="flex-1 bg-[#1e3a5f] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#1e40af] transition-colors flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" />Copiar link
              </button>
              <button onClick={() => setSetupLink(null)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-200 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
