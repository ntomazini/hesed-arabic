'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  BarChart2, Users, FileCheck2, BookOpen, TrendingUp,
  Loader2, AlertCircle, Calendar, Clock, CheckCircle2,
  Award, Target, Download, Zap,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Overview {
  totalWordsConfirmed: number
  totalSegmentsConfirmed: number
  totalFilesCompleted: number
  tmEntriesCount: number
}

interface EditorStat {
  id: string
  name: string
  active: boolean
  filesCount: number
  segmentsConfirmed: number
  wordsConfirmed: number
  avgProgress: number
}

interface ProjectStat {
  id: string
  name: string
  status: string
  deadline: string | null
  totalSegments: number
  confirmedSegments: number
  translationProgress: number
  reviewProgress: number
  wordCount: number
  dailyRate: number
  estimatedDaysLeft: number | null
  estimatedCompletionDate: string | null
}

interface TmStats {
  totalEntries: number
  avgQuality: number
  totalUsed: number
}

interface Analytics {
  overview: Overview
  editors: EditorStat[]
  projects: ProjectStat[]
  tmStats: TmStats
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('pt-BR') }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function shortName(name: string) {
  const parts = name.trim().split(' ')
  return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo', COMPLETED: 'Concluído', PAUSED: 'Pausado', DRAFT: 'Rascunho',
}
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  DRAFT: 'bg-slate-100 text-slate-500',
}

const EDITOR_COLORS = ['#1e3a5f', '#2563eb', '#0891b2', '#0d9488', '#7c3aed']

function MiniBar({ value, color = 'blue' }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function StatCard({
  label, value, sub, icon, accent,
}: { label: string; value: string | number; sub?: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 truncate">{typeof value === 'number' ? fmt(value) : value}</p>
        <p className="text-sm text-slate-500 truncate">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value.toLocaleString('pt-BR')}</span>
        </p>
      ))}
    </div>
  )
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

async function exportPDF(data: Analytics) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Cabeçalho
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Hesed Arabic', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Relatório de Analytics', 14, 20)
  doc.text(`Gerado em: ${now}`, W - 14, 20, { align: 'right' })
  doc.setTextColor(30, 30, 30)

  let y = 36

  // ── Overview
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Visão Geral', 14, y)
  y += 6

  const overview = [
    ['Palavras traduzidas', data.overview.totalWordsConfirmed.toLocaleString('pt-BR')],
    ['Segmentos confirmados', data.overview.totalSegmentsConfirmed.toLocaleString('pt-BR')],
    ['Arquivos concluídos', data.overview.totalFilesCompleted.toLocaleString('pt-BR')],
    ['Entradas na MT', data.tmStats.totalEntries.toLocaleString('pt-BR')],
    ['Qualidade média MT', `${data.tmStats.avgQuality}%`],
    ['Reutilizações MT', data.tmStats.totalUsed.toLocaleString('pt-BR')],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: overview,
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // ── Produtividade por editor
  if (data.editors.length > 0) {
    if (y > 220) { doc.addPage(); y = 20 }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Produtividade por Editor', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Editor', 'Arquivos', 'Segmentos', 'Palavras', 'Progresso Médio']],
      body: data.editors.map(e => [
        e.name,
        e.filesCount,
        e.segmentsConfirmed.toLocaleString('pt-BR'),
        e.wordsConfirmed.toLocaleString('pt-BR'),
        `${e.avgProgress}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 95], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // ── Progresso por projeto
  if (data.projects.length > 0) {
    if (y > 200) { doc.addPage(); y = 20 }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Progresso por Projeto', 14, y)
    y += 4

    const STATUS_PT: Record<string, string> = {
      ACTIVE: 'Ativo', COMPLETED: 'Concluído', PAUSED: 'Pausado', DRAFT: 'Rascunho',
    }

    autoTable(doc, {
      startY: y,
      head: [['Projeto', 'Status', 'Tradução', 'Revisão', 'Palavras', 'Prazo']],
      body: data.projects.map(p => [
        p.name,
        STATUS_PT[p.status] ?? p.status,
        `${p.translationProgress}%`,
        `${p.reviewProgress}%`,
        p.wordCount.toLocaleString('pt-BR'),
        p.deadline ? new Date(p.deadline).toLocaleDateString('pt-BR') : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 95], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // ── Estimativas (projetos ativos com ritmo)
  const active = data.projects.filter(p => p.status === 'ACTIVE' && p.dailyRate > 0)
  if (active.length > 0) {
    if (y > 200) { doc.addPage(); y = 20 }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Estimativa de Conclusão', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Projeto', 'Ritmo (seg/dia)', 'Dias restantes', 'Conclusão estimada']],
      body: active.map(p => [
        p.name,
        p.dailyRate,
        p.estimatedDaysLeft !== null ? `~${p.estimatedDaysLeft} dias` : '—',
        p.estimatedCompletionDate
          ? new Date(p.estimatedCompletionDate).toLocaleDateString('pt-BR')
          : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 95], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
  }

  // ── Rodapé em todas as páginas
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Hesed Arabic Platform  ·  Página ${i} de ${pages}`, W / 2, 290, { align: 'center' })
  }

  doc.save(`hesed-analytics-${now.replace(/\//g, '-')}.pdf`)
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface AiUsage {
  period: { days: number }
  totals: { DEEPL: { calls: number; chars: number }; CLAUDE: { calls: number; chars: number } }
  byDay: { date: string; deepl: number; claude: number }[]
  byUser: { userId: string; name?: string; deepl: number; claude: number }[]
  estimates: { deeplFreeLimit: number; deeplUsedTotal: number; deeplUsedPercent: number; claudeCostUSD: number }
}

export default function AnalyticsPage() {
  const [exporting, setExporting] = useState(false)
  const [aiDays, setAiDays] = useState(30)

  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey: ['analytics'],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics')
      return data
    },
    refetchInterval: 60_000,
  })

  const { data: aiData } = useQuery<AiUsage>({
    queryKey: ['ai-usage', aiDays],
    queryFn: async () => {
      const { data } = await api.get(`/api/ai/usage?days=${aiDays}`)
      return data
    },
    refetchInterval: 120_000,
  })

  async function handleExportPDF() {
    if (!data) return
    setExporting(true)
    try { await exportPDF(data) } finally { setExporting(false) }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">Erro ao carregar analytics</p>
      </div>
    )
  }

  const { overview, editors, projects, tmStats } = data
  const activeProjects = projects.filter(p => p.status === 'ACTIVE' && p.dailyRate > 0)

  // Chart data
  const editorChartData = editors.map((e, i) => ({
    name: shortName(e.name),
    'Palavras': e.wordsConfirmed,
    'Segmentos': e.segmentsConfirmed,
    color: EDITOR_COLORS[i % EDITOR_COLORS.length],
  }))

  const projectChartData = projects.map(p => ({
    name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
    'Tradução': p.translationProgress,
    'Revisão': p.reviewProgress,
  }))

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#1e3a5f]" />
            Analytics
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Dados reais de produtividade e progresso da plataforma</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting || !data}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {exporting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />}
          {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
        </button>
      </div>

      {/* ── Overview cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Palavras traduzidas"
          value={overview.totalWordsConfirmed}
          sub="segmentos confirmados"
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
          accent="bg-blue-50"
        />
        <StatCard
          label="Segmentos confirmados"
          value={overview.totalSegmentsConfirmed}
          sub="total na plataforma"
          icon={<CheckCircle2 className="w-6 h-6 text-green-600" />}
          accent="bg-green-50"
        />
        <StatCard
          label="Arquivos concluídos"
          value={overview.totalFilesCompleted}
          sub="status DONE"
          icon={<FileCheck2 className="w-6 h-6 text-purple-600" />}
          accent="bg-purple-50"
        />
        <StatCard
          label="Entradas na MT"
          value={tmStats.totalEntries}
          sub={`qualidade média: ${tmStats.avgQuality}%`}
          icon={<BookOpen className="w-6 h-6 text-amber-600" />}
          accent="bg-amber-50"
        />
      </div>

      {/* ── Gráfico: Produtividade por editor ─────────────────────────────── */}
      {editorChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Palavras Traduzidas por Editor</h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={editorChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Palavras" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {editorChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Tabela: Produtividade por editor ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Produtividade por Editor</h3>
          <span className="ml-auto text-xs text-slate-400">{editors.length} editor(es)</span>
        </div>

        {editors.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum editor cadastrado ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Editor', 'Arquivos', 'Segmentos Confirmados', 'Palavras Traduzidas', 'Progresso Médio'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {editors.map((e, idx) => {
                  const maxWords = editors[0]?.wordsConfirmed || 1
                  return (
                    <tr key={e.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xs font-bold text-[#1e3a5f]">
                            {e.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{e.name}</p>
                            {!e.active && <span className="text-xs text-slate-400">inativo</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{e.filesCount}</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-800">{fmt(e.segmentsConfirmed)}</span>
                      </td>
                      <td className="px-5 py-3 min-w-[180px]">
                        <div>
                          <span className="font-semibold text-slate-800">{fmt(e.wordsConfirmed)}</span>
                          <MiniBar value={e.wordsConfirmed / maxWords * 100} color="bg-blue-400" />
                        </div>
                      </td>
                      <td className="px-5 py-3 min-w-[140px]">
                        <div>
                          <span className="text-slate-700">{e.avgProgress}%</span>
                          <MiniBar value={e.avgProgress} color="bg-green-400" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Gráfico: Progresso por projeto ────────────────────────────────── */}
      {projectChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Progresso por Projeto (%)</h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={projectChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                <Bar dataKey="Tradução" fill="#1e3a5f" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Revisão" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Progresso por projeto (detalhes) ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Target className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Progresso por Projeto</h3>
          <span className="ml-auto text-xs text-slate-400">{projects.length} projeto(s)</span>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum projeto encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {projects.map(p => (
              <div key={p.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmt(p.wordCount)} palavras · {fmt(p.totalSegments)} segmentos
                      {p.deadline && ` · Prazo: ${fmtDate(p.deadline)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Tradução</p>
                    <p className="text-lg font-bold text-[#1e3a5f]">{p.translationProgress}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Tradução ({fmt(p.confirmedSegments)}/{fmt(p.totalSegments)} seg.)</span>
                      <span>{p.translationProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
                        style={{ width: `${p.translationProgress}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Revisão</span>
                      <span>{p.reviewProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${p.reviewProgress}%` }} />
                    </div>
                  </div>
                </div>

                {p.dailyRate > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Ritmo (7 dias): <span className="font-semibold text-slate-600">{p.dailyRate} seg/dia</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Estimativa de conclusão ────────────────────────────────────────── */}
      {activeProjects.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Estimativa de Conclusão</h3>
            <span className="text-xs text-slate-400 ml-1">(baseada no ritmo dos últimos 7 dias)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Projeto', 'Restam', 'Ritmo atual', 'Dias restantes', 'Conclusão estimada', 'Prazo'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeProjects.map((p, idx) => {
                  const remaining = p.totalSegments - p.confirmedSegments
                  const isLate = p.deadline && p.estimatedCompletionDate &&
                    p.estimatedCompletionDate > p.deadline.split('T')[0]
                  return (
                    <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-5 py-3 font-medium text-slate-800 max-w-[200px] truncate">{p.name}</td>
                      <td className="px-5 py-3 text-slate-600">{fmt(remaining)} seg.</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-blue-600">{p.dailyRate}</span>
                        <span className="text-slate-400 text-xs ml-1">seg/dia</span>
                      </td>
                      <td className="px-5 py-3">
                        {p.estimatedDaysLeft !== null ? (
                          <span className={`font-semibold ${p.estimatedDaysLeft <= 7 ? 'text-green-600' : p.estimatedDaysLeft <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                            ~{p.estimatedDaysLeft} dias
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className={isLate ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                            {fmtDate(p.estimatedCompletionDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{fmtDate(p.deadline)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Estimativas baseadas na taxa de confirmação dos últimos 7 dias. Projetos sem atividade recente não aparecem nesta tabela.
            </p>
          </div>
        </div>
      )}

      {/* ── Memória de Tradução ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'Entradas na MT',
            value: fmt(tmStats.totalEntries),
            icon: <BookOpen className="w-5 h-5 text-amber-600" />,
            accent: 'bg-amber-50 border-amber-100',
            desc: 'pares source/target armazenados',
          },
          {
            label: 'Qualidade média',
            value: `${tmStats.avgQuality}%`,
            icon: <Award className="w-5 h-5 text-blue-600" />,
            accent: 'bg-blue-50 border-blue-100',
            desc: 'dos segmentos na MT',
          },
          {
            label: 'Reutilizações',
            value: fmt(tmStats.totalUsed),
            icon: <TrendingUp className="w-5 h-5 text-green-600" />,
            accent: 'bg-green-50 border-green-100',
            desc: 'vezes que a MT foi usada',
          },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-5 ${c.accent}`}>
            <div className="flex items-center gap-2 mb-2">
              {c.icon}
              <span className="text-sm font-medium text-slate-700">{c.label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* ── USO DA IA ───────────────────────────────────────────────── */}
      <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Uso da IA
        </h2>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map(d => (
            <button key={d}
              onClick={() => setAiDays(d)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                aiDays === d ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {aiData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'DeepL — Chamadas', value: fmt(aiData.totals.DEEPL.calls), sub: `${fmt(aiData.totals.DEEPL.chars)} chars`, color: 'bg-sky-50 border-sky-100', icon: '🔵' },
              { label: 'DeepL — Uso do plano', value: `${aiData.estimates.deeplUsedPercent}%`, sub: 'de 500k chars/mês gratuitos', color: 'bg-sky-50 border-sky-100', icon: '📊' },
              { label: 'Claude — Chamadas', value: fmt(aiData.totals.CLAUDE.calls), sub: `${fmt(aiData.totals.CLAUDE.chars)} chars`, color: 'bg-violet-50 border-violet-100', icon: '🟣' },
              { label: 'Claude — Custo est.', value: `US$ ${aiData.estimates.claudeCostUSD.toFixed(4)}`, sub: `nos últimos ${aiDays} dias`, color: 'bg-violet-50 border-violet-100', icon: '💵' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                  <span>{c.icon}</span>{c.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{c.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Consumo DeepL Free (500k chars/mês)</p>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  aiData.estimates.deeplUsedPercent >= 90 ? 'bg-red-500'
                  : aiData.estimates.deeplUsedPercent >= 70 ? 'bg-amber-400'
                  : 'bg-sky-500'
                }`}
                style={{ width: `${Math.min(100, aiData.estimates.deeplUsedPercent)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {fmt(aiData.estimates.deeplUsedTotal)} / 500.000 chars usados no período
            </p>
          </div>

          {aiData.byDay.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Caracteres traduzidos por dia</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={aiData.byDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${fmt(typeof v === 'number' ? v : 0)} chars`]} />
                  <Legend />
                  <Bar dataKey="deepl" name="DeepL" fill="#0ea5e9" radius={[3,3,0,0]} />
                  <Bar dataKey="claude" name="Claude" fill="#7c3aed" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {aiData.byUser.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Uso por tradutor</p>
              <div className="space-y-2">
                {aiData.byUser.map(u => (
                  <div key={u.userId} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-36 truncate font-medium">{u.name ?? u.userId}</span>
                    <div className="flex-1 flex gap-1">
                      <div className="bg-sky-100 rounded px-2 py-0.5 text-xs text-sky-700 font-mono">
                        DeepL: {fmt(u.deepl)}
                      </div>
                      {u.claude > 0 && (
                        <div className="bg-violet-100 rounded px-2 py-0.5 text-xs text-violet-700 font-mono">
                          Claude: {fmt(u.claude)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum uso de IA registrado no período</p>
        </div>
      )}
      </div>

    </div>
  )
}
