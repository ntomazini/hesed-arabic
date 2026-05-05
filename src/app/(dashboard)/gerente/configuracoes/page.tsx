'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings, Globe, Bell, Shield, Palette,
  Brain, ChevronUp, ChevronDown, CheckCircle2,
  AlertTriangle, GripVertical, Save, RotateCcw,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

// ── Tipos ──────────────────────────────────────────────────────────────────────

type ProviderId = 'deepl' | 'openai' | 'claude'

interface AiProviderConfig {
  id:      ProviderId
  name:    string
  enabled: boolean
}

interface AiConfigResponse {
  providers: AiProviderConfig[]
  apiKeys:   Record<ProviderId, boolean>
}

// ── Metadados visuais por provedor ────────────────────────────────────────────

const PROVIDER_META: Record<ProviderId, {
  label:    string
  desc:     string
  color:    string
  bgLight:  string
  logo:     string
}> = {
  deepl: {
    label:   'DeepL',
    desc:    'Motor neural de tradução — rápido e preciso para textos técnicos',
    color:   'text-blue-700',
    bgLight: 'bg-blue-50 border-blue-200',
    logo:    'D',
  },
  openai: {
    label:   'OpenAI (GPT-4o-mini)',
    desc:    'GPT-4o-mini da OpenAI — ótimo custo-benefício para textos bíblicos',
    color:   'text-emerald-700',
    bgLight: 'bg-emerald-50 border-emerald-200',
    logo:    'O',
  },
  claude: {
    label:   'Claude (Haiku)',
    desc:    'Claude Haiku da Anthropic — fallback confiável com glossário avançado',
    color:   'text-purple-700',
    bgLight: 'bg-purple-50 border-purple-200',
    logo:    'C',
  },
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const [providers, setProviders] = useState<AiProviderConfig[]>([])
  const [apiKeys,   setApiKeys]   = useState<Record<ProviderId, boolean>>({ deepl: false, openai: false, claude: false })
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [dirty,     setDirty]     = useState(false)

  // ── Carrega config ─────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<AiConfigResponse>('/api/config/ai')
      setProviders(data.providers)
      setApiKeys(data.apiKeys)
      setDirty(false)
    } catch {
      toast.error('Não foi possível carregar as configurações de IA')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  // ── Ações ──────────────────────────────────────────────────────────────────
  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...providers]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setProviders(next)
    setDirty(true)
  }

  function moveDown(idx: number) {
    if (idx === providers.length - 1) return
    const next = [...providers]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setProviders(next)
    setDirty(true)
  }

  function toggleEnabled(idx: number) {
    setProviders(prev => prev.map((p, i) => i === idx ? { ...p, enabled: !p.enabled } : p))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await api.put('/api/config/ai', { providers })
      toast.success('Configuração salva com sucesso!')
      setDirty(false)
    } catch {
      toast.error('Falha ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Configurações</h2>
        <p className="text-slate-500 text-sm mt-0.5">Configurações gerais da plataforma.</p>
      </div>

      {/* ── Painel de IA ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Cabeçalho do painel */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Provedores de IA</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina a ordem de tentativa e quais provedores estão ativos no modo automático
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={loadConfig}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Desfazer
              </button>
            )}
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="flex items-center gap-2 text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />
              }
              Salvar
            </button>
          </div>
        </div>

        {/* Legenda */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5" /> Arraste ou use as setas para reordenar
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Chave API configurada
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Chave API não configurada
          </span>
        </div>

        {/* Lista de provedores */}
        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : (
            providers.map((p, idx) => {
              const meta    = PROVIDER_META[p.id]
              const hasKey  = apiKeys[p.id]
              const isFirst = idx === 0
              const isLast  = idx === providers.length - 1

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                    p.enabled ? 'bg-white' : 'bg-slate-50/60 opacity-60'
                  }`}
                >
                  {/* Posição */}
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                    {idx + 1}
                  </div>

                  {/* Logo */}
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm flex-shrink-0 ${meta.bgLight} ${meta.color}`}>
                    {meta.logo}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${p.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                        {meta.label}
                      </span>
                      {/* Status da chave */}
                      {hasKey ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> API configurada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Sem chave API
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{meta.desc}</p>
                  </div>

                  {/* Setas de reordenação */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={isFirst}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Mover para cima (maior prioridade)"
                    >
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={isLast}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Mover para baixo (menor prioridade)"
                    >
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>

                  {/* Toggle ativo */}
                  <button
                    onClick={() => toggleEnabled(idx)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      p.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                    title={p.enabled ? 'Desativar provedor' : 'Ativar provedor'}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        p.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé explicativo */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            <strong className="text-slate-500">Modo automático:</strong> o sistema tenta os provedores na ordem acima, usando o primeiro que retornar tradução com sucesso. Provedores desativados são ignorados. Esta configuração afeta a pré-tradução e a tradução manual.
          </p>
        </div>
      </div>

      {/* ── Cards de outras configurações ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: Globe,   title: 'Idiomas',       desc: 'Gerenciar pares de idiomas ativos na plataforma',         color: 'text-blue-600 bg-blue-50' },
          { icon: Bell,    title: 'Notificações',   desc: 'Configurar alertas de email e notificações do sistema',   color: 'text-orange-600 bg-orange-50' },
          { icon: Shield,  title: 'Segurança',      desc: 'Políticas de senha, sessão e autenticação',               color: 'text-green-600 bg-green-50' },
          { icon: Palette, title: 'Aparência',      desc: 'Tema, logo e personalização visual',                     color: 'text-purple-600 bg-purple-50' },
        ].map(item => (
          <div
            key={item.title}
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="text-slate-500 text-sm mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Informações da Plataforma ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Informações da Plataforma
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-500">Nome da plataforma</span>
            <span className="font-medium text-slate-900">Hesed Translation</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-500">Versão</span>
            <span className="font-medium text-slate-900">1.0.0</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Empresa</span>
            <span className="font-medium text-slate-900">Hesed Assessoria</span>
          </div>
        </div>
      </div>
    </div>
  )
}
