'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Database, Upload, Download, Search, Loader2, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface TMEntry {
  id: string
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  quality: number
  domain?: string | null
  usedCount: number
  createdAt: string
}

export default function MemoriaPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [tmxFile, setTmxFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tm-entries', q],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      const { data } = await api.get(`/api/tm?${params}`)
      return { entries: data.entries as TMEntry[], total: data.total as number }
    },
  })
  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tm/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tm-entries'] })
      toast.success('Entrada removida!')
    },
    onError: () => toast.error('Erro ao remover entrada'),
  })

  async function handleImport() {
    if (!tmxFile) return
    setImporting(true)
    try {
      const text = await tmxFile.text()
      const ext = tmxFile.name.split('.').pop()?.toLowerCase() ?? 'tmx'
      // For DOCX, send as base64 since it's binary
      let content: string
      let isBase64 = false
      if (ext === 'docx') {
        const buf = await tmxFile.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        bytes.forEach(b => { binary += String.fromCharCode(b) })
        content = btoa(binary)
        isBase64 = true
      } else {
        content = text
      }
      const { data } = await api.post('/api/tm', { content, fileType: ext, isBase64 })
      queryClient.invalidateQueries({ queryKey: ['tm-entries'] })
      setShowImportModal(false)
      setTmxFile(null)
      toast.success(`${data.imported} entrada${data.imported !== 1 ? 's' : ''} importada${data.imported !== 1 ? 's' : ''}${data.skipped > 0 ? `, ${data.skipped} ignorada(s)` : ''}!`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao importar TMX'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  function exportTMX() {
    if (entries.length === 0) { toast.error('Nenhuma entrada para exportar'); return }
    const tus = entries.map(e => `  <tu>
    <tuv xml:lang="${e.sourceLang}"><seg>${e.sourceText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</seg></tuv>
    <tuv xml:lang="${e.targetLang}"><seg>${e.targetText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</seg></tuv>
  </tu>`).join('\n')
    const tmx = `<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4">\n  <header srclang="en" adminlang="en" datatype="plaintext" />\n  <body>\n${tus}\n  </body>\n</tmx>`
    const blob = new Blob([tmx], { type: 'text/xml;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'memoria-hesed.tmx'; a.click()
    URL.revokeObjectURL(url)
    toast.success('TMX exportado!')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Memória de Tradução</h2>
          <p className="text-slate-500 text-sm mt-0.5">Banco de segmentos traduzidos para reutilização.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={exportTMX}>Exportar TMX</Button>
          <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={() => setShowImportModal(true)}>Importar TMX</Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input-field pl-9" placeholder="Buscar segmentos na memória..."
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {/* Entries */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Database className="w-10 h-10 mb-2 opacity-40" />
            <h3 className="text-sm font-semibold text-slate-600 mb-1">Memória de Tradução vazia</h3>
            <p className="text-xs text-center max-w-sm">Os segmentos confirmados pelos editores serão salvos aqui automaticamente. Você também pode importar um arquivo TMX.</p>
            <button onClick={() => setShowImportModal(true)} className="mt-3 text-[#1e3a5f] text-sm font-medium hover:underline">Importar TMX</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Texto Fonte</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Texto Alvo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Par</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usos</th>
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-700 max-w-xs">
                        <p className="line-clamp-2 text-xs">{e.sourceText}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-700 max-w-xs">
                        <p className="line-clamp-2 text-xs">{e.targetText}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {e.sourceLang.toUpperCase()} → {e.targetLang.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{e.usedCount}×</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { if (confirm('Remover esta entrada?')) deleteMutation.mutate(e.id) }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-slate-50 text-xs text-slate-400">
                {total} entrada{total !== 1 ? 's' : ''} no total
              </div>
            </div>
          </>
        )}
      </div>

      {/* Import TMX Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Importar TMX</h3>
                <p className="text-sm text-slate-500">Arquivo de Memória de Tradução</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600">
              Formatos suportados: <strong>.tmx</strong>, <strong>.xml</strong>, <strong>.txt</strong>, <strong>.md</strong>, <strong>.html</strong>, <strong>.docx</strong>.<br />
              Para .txt/.md: cada linha <code className="bg-slate-200 px-1 rounded">origem|||destino</code> ou separado por tab.<br />
              Para .html/.docx: tabela com 2 colunas (texto fonte | texto alvo).
            </div>
            <input
              type="file" accept=".tmx,.xml,.txt,.md,.html,.htm,.docx"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e3a5f] file:text-white hover:file:bg-[#1e40af] cursor-pointer mb-4"
              onChange={e => setTmxFile(e.target.files?.[0] ?? null)}
            />
            {tmxFile && (
              <p className="text-xs text-slate-500 mb-4">Arquivo: <strong>{tmxFile.name}</strong> ({(tmxFile.size / 1024).toFixed(1)} KB)</p>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowImportModal(false); setTmxFile(null) }} disabled={importing}>Cancelar</Button>
              <Button variant="primary" className="flex-1" onClick={handleImport} disabled={!tmxFile} loading={importing}>
                {importing ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
