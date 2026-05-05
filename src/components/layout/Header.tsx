'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Bell, Check, CheckCheck, Clock, FileCheck, FileText, AlertTriangle, LogOut } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import type { Role, NotifType } from '@prisma/client'

interface Notification {
  id: string
  type: NotifType
  title: string
  message: string
  read: boolean
  link: string | null
  createdAt: string
}

const pageTitles: Record<string, string> = {
  '/gerente': 'Dashboard',
  '/gerente/projetos': 'Projetos',
  '/gerente/equipe': 'Equipe',
  '/gerente/memoria': 'Memória de Tradução',
  '/gerente/glossario': 'Glossário',
  '/gerente/configuracoes': 'Configurações',
  '/gerente/analytics': 'Analytics',
  '/editor': 'Meus Trabalhos',
  '/editor/arquivos': 'Meus Arquivos',
  '/revisor': 'Minhas Revisões',
  '/revisor/revisoes': 'Revisões',
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  const sorted = Object.keys(pageTitles).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    if (pathname.startsWith(key)) return pageTitles[key]
  }
  return 'Hesed Arabic'
}

function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = { GERENTE: 'Gerente', EDITOR: 'Editor', REVISOR: 'Revisor' }
  return labels[role]
}

function getRoleBadgeColor(role: Role): string {
  const colors: Record<Role, string> = {
    GERENTE: 'bg-purple-100 text-purple-700',
    EDITOR: 'bg-blue-100 text-blue-700',
    REVISOR: 'bg-orange-100 text-orange-700',
  }
  return colors[role]
}

function notifIcon(type: NotifType) {
  const cls = 'w-4 h-4 shrink-0'
  switch (type) {
    case 'SEGMENT_REJECTED':     return <AlertTriangle className={clsx(cls, 'text-red-500')} />
    case 'FILE_TO_REVIEW':       return <FileText className={clsx(cls, 'text-blue-500')} />
    case 'FILE_DONE':            return <FileCheck className={clsx(cls, 'text-green-500')} />
    case 'PROJECT_COMPLETED':    return <CheckCheck className={clsx(cls, 'text-green-600')} />
    case 'DEADLINE_APPROACHING': return <Clock className={clsx(cls, 'text-amber-500')} />
    default:                     return <Bell className={clsx(cls, 'text-slate-400')} />
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function Header() {
  const pathname = usePathname()
  const router   = useRouter()
  const { data: session } = useSession()

  const [open, setOpen]        = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [notifs, setNotifs]    = useState<Notification[]>([])
  const [unread, setUnread]    = useState(0)

  const title    = getPageTitle(pathname)
  const user     = session?.user
  const role     = user?.role as Role | undefined
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const loadNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json() as { notifications: Notification[]; unreadCount: number }
      setNotifs(data.notifications)
      setUnread(data.unreadCount)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!session?.user) return
    loadNotifs()
    const t = setInterval(loadNotifs, 60_000)
    return () => clearInterval(t)
  }, [session?.user, loadNotifs])

  useEffect(() => {
    if (open) loadNotifs()
  }, [open, loadNotifs])

  async function markOne(notif: Notification) {
    if (!notif.read) {
      await fetch(`/api/notifications/${notif.id}`, { method: 'PATCH' })
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    }
    if (notif.link) {
      setOpen(false)
      router.push(notif.link)
    }
  }

  async function markAll() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between h-16 flex-shrink-0">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications bell */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center px-0.5">
                <span className="text-white text-[10px] font-bold leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden">
                {/* Dropdown header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Notificações
                    {unread > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-red-500">({unread} nova{unread > 1 ? 's' : ''})</span>
                    )}
                  </h3>
                  {unread > 0 && (
                    <button
                      onClick={markAll}
                      className="flex items-center gap-1 text-xs text-[#1e3a5f] hover:underline font-medium"
                    >
                      <Check className="w-3 h-3" />
                      Marcar todas
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Nenhuma notificação</p>
                    </div>
                  ) : (
                    notifs.map(n => (
                      <button
                        key={n.id}
                        onClick={() => markOne(n)}
                        className={clsx(
                          'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 items-start',
                          !n.read && 'bg-blue-50/50'
                        )}
                      >
                        <span className="mt-0.5">{notifIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={clsx(
                            'text-sm leading-tight',
                            n.read ? 'text-slate-600 font-normal' : 'text-slate-900 font-semibold'
                          )}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-normal leading-snug">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-300 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User info + logout dropdown */}
        {user && role && (
          <div className="relative pl-3 border-l border-slate-100">
            <button
              onClick={() => setUserMenu(v => !v)}
              className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div className="w-8 h-8 bg-[#1e3a5f] rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</p>
                <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded', getRoleBadgeColor(role))}>
                  {getRoleLabel(role)}
                </span>
              </div>
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-50">
                    <p className="text-xs font-semibold text-slate-700 truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={async () => {
                      setUserMenu(false)
                      await signOut({ redirect: false })
                      router.push('/login')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
