'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Users,
  BookOpen,
  Database,
  Settings,
  LogOut,
  BarChart2,
  Bell,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Role } from '@prisma/client'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: Role[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/gerente',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Dashboard',
    href: '/editor',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['EDITOR'],
  },
  {
    label: 'Dashboard',
    href: '/revisor',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['REVISOR'],
  },
  {
    label: 'Projetos',
    href: '/gerente/projetos',
    icon: <FolderOpen className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Usuários',
    href: '/gerente/usuarios',
    icon: <Users className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Meus Arquivos',
    href: '/editor/arquivos',
    icon: <FileText className="w-5 h-5" />,
    roles: ['EDITOR'],
  },
  {
    label: 'Revisões',
    href: '/revisor/revisoes',
    icon: <FileText className="w-5 h-5" />,
    roles: ['REVISOR'],
  },
  {
    label: 'Memória de Tradução',
    href: '/gerente/memoria',
    icon: <Database className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Glossário',
    href: '/gerente/glossario',
    icon: <BookOpen className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Analytics',
    href: '/gerente/analytics',
    icon: <BarChart2 className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Configurações',
    href: '/gerente/configuracoes',
    icon: <Settings className="w-5 h-5" />,
    roles: ['GERENTE'],
  },
  {
    label: 'Notificações',
    href: '/notificacoes',
    icon: <Bell className="w-5 h-5" />,
    roles: ['GERENTE', 'EDITOR', 'REVISOR'],
  },
]

export default function Sidebar() {
  const [hovered, setHovered] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role as Role | undefined

  const filteredItems = navItems.filter(
    (item) => role && item.roles.includes(role)
  )

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <>
      {/* Espaço reservado — mantém o layout quando a sidebar colapsa */}
      <div className="w-16 shrink-0" />

      {/* Sidebar flutuante — sempre colapsada, expande ao hover */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={clsx(
          'fixed left-0 top-0 bottom-0 flex flex-col bg-[#1e3a5f] text-white transition-all duration-200 z-30 overflow-hidden',
          hovered ? 'w-64 shadow-2xl' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center border-b border-white/10 py-4 flex-shrink-0',
          hovered ? 'px-5 gap-3' : 'justify-center px-2'
        )}>
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-[#1e3a5f] font-bold text-base">HA</span>
          </div>
          <div className={clsx(
            'overflow-hidden transition-all duration-200',
            hovered ? 'w-auto opacity-100' : 'w-0 opacity-0'
          )}>
            <p className="font-bold text-sm leading-tight whitespace-nowrap">Hesed Arabic</p>
            <p className="text-blue-300 text-xs whitespace-nowrap">Plataforma</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!hovered ? item.label : undefined}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white',
                  !hovered && 'justify-center'
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={clsx(
                  'truncate whitespace-nowrap transition-all duration-200',
                  hovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                )}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: user info + logout */}
        <div className="border-t border-white/10 p-3 space-y-2 flex-shrink-0">
          {hovered && session?.user && (
            <div className="px-2 py-1">
              <p className="text-xs font-semibold text-white truncate">{session.user.name}</p>
              <p className="text-xs text-blue-300 capitalize">{role?.toLowerCase()}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={!hovered ? 'Sair' : undefined}
            className={clsx(
              'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-colors',
              !hovered && 'justify-center'
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={clsx(
              'whitespace-nowrap transition-all duration-200',
              hovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
            )}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
