import { clsx } from 'clsx'

type BadgeVariant =
  | 'ready'
  | 'translating'
  | 'translated'
  | 'reviewing'
  | 'done'
  | 'pending'
  | 'confirmed'
  | 'reviewed'
  | 'rejected'
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

interface BadgeProps {
  variant: BadgeVariant
  label?: string
  className?: string
}

const variantConfig: Record<BadgeVariant, { classes: string; defaultLabel: string }> = {
  ready: {
    classes: 'bg-slate-100 text-slate-600',
    defaultLabel: 'Pronto',
  },
  translating: {
    classes: 'bg-blue-100 text-blue-700',
    defaultLabel: 'Traduzindo',
  },
  translated: {
    classes: 'bg-indigo-100 text-indigo-700',
    defaultLabel: 'Traduzido',
  },
  reviewing: {
    classes: 'bg-orange-100 text-orange-700',
    defaultLabel: 'Em Revisão',
  },
  done: {
    classes: 'bg-green-100 text-green-700',
    defaultLabel: 'Concluído',
  },
  pending: {
    classes: 'bg-slate-100 text-slate-500',
    defaultLabel: 'Pendente',
  },
  confirmed: {
    classes: 'bg-blue-100 text-blue-700',
    defaultLabel: 'Confirmado',
  },
  reviewed: {
    classes: 'bg-green-100 text-green-700',
    defaultLabel: 'Revisado',
  },
  rejected: {
    classes: 'bg-red-100 text-red-700',
    defaultLabel: 'Rejeitado',
  },
  draft: {
    classes: 'bg-slate-100 text-slate-500',
    defaultLabel: 'Rascunho',
  },
  active: {
    classes: 'bg-blue-100 text-blue-700',
    defaultLabel: 'Ativo',
  },
  paused: {
    classes: 'bg-yellow-100 text-yellow-700',
    defaultLabel: 'Pausado',
  },
  completed: {
    classes: 'bg-green-100 text-green-700',
    defaultLabel: 'Concluído',
  },
  archived: {
    classes: 'bg-slate-100 text-slate-400',
    defaultLabel: 'Arquivado',
  },
}

export default function Badge({ variant, label, className }: BadgeProps) {
  const config = variantConfig[variant]

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.classes,
        className
      )}
    >
      {label ?? config.defaultLabel}
    </span>
  )
}

// Helper to map Prisma enums to badge variants
export function fileStatusToBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    READY: 'ready',
    TRANSLATING: 'translating',
    TRANSLATED: 'translated',
    REVIEWING: 'reviewing',
    DONE: 'done',
    REJECTED: 'rejected',
  }
  return map[status] ?? 'pending'
}

export function projectStatusToBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
  }
  return map[status] ?? 'draft'
}

export function segmentStatusToBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    PENDING: 'pending',
    TRANSLATING: 'translating',
    TRANSLATED: 'translated',
    CONFIRMED: 'confirmed',
    REVIEWED: 'reviewed',
    REJECTED: 'rejected',
  }
  return map[status] ?? 'pending'
}
