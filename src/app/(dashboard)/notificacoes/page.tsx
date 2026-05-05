'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import {
  Bell, CheckCheck, Filter, Loader2, AlertCircle,
  Clock, FileCheck2, XCircle, ArrowRight, BookOpen, Inbox,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type NotifType =
  | 'SEGMENT_REJECTED'
  | 'FILE_TO_REVIEW'
  | 'FILE_DONE'
  | 'PROJECT_COMPLETED'
  | 'DEADLINE_APPROACHING'

interface Notification {
  id: string
  type: NotifType
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

interface NotifResponse {
  notifications: Notification[]
  unreadCount: number
}

// ── Config ─────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotifType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  SEGMENT_REJECTED: {
    label: 'Segmento rejeitado',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-100',
  },
  FILE_TO_REVIEW: {
    label: 'Arquivo para revisar',
    icon: <FileCheck2 className="w-4 h-4" />,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100',
  },
  FILE_DONE: {
    label: 'Arquivo concluído',
    icon: <CheckCheck className="w-4 h-4" />,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-100',
  },
  PROJECT_COMPLETED: {
    label: 'Projeto concluído',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-100',
  },
  DEADLINE_APPROACHING: {
    label: 'Prazo próximo',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-100',
  },
}

const ALL_TYPES = Object.keys(TYPE_CONFIG) as NotifType[]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora mesmo'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NotificacoesPage() {
  const [typeFilter, setTypeFilter] = useState<NotifType | ''>('')
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<NotifResponse>({
    queryKey: ['notifications-all', typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ all: 'true' })
      if (typeFilter) params.set('type', typeFilter)
      const { data } = await api.get(`/api/notifications?${params}`)
      return data
    },
    refetchInterval: 30_000,
  })

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/api/notifications'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markOneRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}`, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#1e3a5f]" />
            Notificações
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Histórico completo de todas as notificações</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a] disabled:opacity-50 transition-colors shrink-0"
          >
            {markAllRead.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCheck className="w-4 h-4" />}
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtros por tipo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            typeFilter === ''
              ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          <Filter className="w-3 h-3" />
          Todos
        </button>
        {ALL_TYPES.map(type => {
          const cfg = TYPE_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === type
                  ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={typeFilter === type ? 'text-white' : cfg.color}>{cfg.icon}</span>
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center py-16 text-slate-400 gap-2">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm">Erro ao carregar notificações</p>
          </div>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <div className="flex flex-col items-center py-16 text-slate-400 gap-2">
            <Inbox className="w-10 h-10 opacity-40" />
            <p className="text-sm">Nenhuma notificação encontrada</p>
          </div>
        )}

        {!isLoading && notifications.length > 0 && (
          <ul className="divide-y divide-slate-50">
            {notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.FILE_DONE
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    n.read ? 'bg-white hover:bg-slate-50/50' : 'bg-blue-50/30 hover:bg-blue-50/50'
                  }`}
                >
                  {/* Ícone */}
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>
                          {n.title}
                          {!n.read && (
                            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 align-middle" />
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => markOneRead.mutate(n.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          >
                            Marcar lida
                          </button>
                        )}
                        {n.link && (
                          <Link
                            href={n.link}
                            className="flex items-center gap-1 text-xs text-[#1e3a5f] hover:text-[#162d4a] font-medium whitespace-nowrap"
                          >
                            Ver <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {notifications.length > 0 && (
        <p className="text-xs text-center text-slate-400">
          {notifications.length} notificação(ões) · {unreadCount} não lida(s)
        </p>
      )}
    </div>
  )
}
