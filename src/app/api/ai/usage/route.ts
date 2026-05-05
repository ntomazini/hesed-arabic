import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/ai/usage?days=30
// Retorna estatísticas de uso da IA agrupadas por provedor e por dia
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10) || 30))
    const since = new Date()
    since.setDate(since.getDate() - days)

    const logs = await db.aiUsageLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    })

    // Totais por provedor
    const totals: Record<string, { calls: number; chars: number }> = {
      DEEPL:  { calls: 0, chars: 0 },
      CLAUDE: { calls: 0, chars: 0 },
      OPENAI: { calls: 0, chars: 0 },
    }
    for (const log of logs) {
      if (!totals[log.provider]) totals[log.provider] = { calls: 0, chars: 0 }
      totals[log.provider].calls++
      totals[log.provider].chars += log.chars
    }

    // Uso por dia (últimos N dias)
    const byDay: Record<string, { deepl: number; claude: number; openai: number }> = {}
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = { deepl: 0, claude: 0, openai: 0 }
      if (log.provider === 'DEEPL')       byDay[day].deepl  += log.chars
      else if (log.provider === 'OPENAI') byDay[day].openai += log.chars
      else                                byDay[day].claude += log.chars
    }

    // Uso por usuário
    const byUser: Record<string, { deepl: number; claude: number; openai: number; name?: string }> = {}
    for (const log of logs) {
      if (!byUser[log.userId]) byUser[log.userId] = { deepl: 0, claude: 0, openai: 0 }
      if (log.provider === 'DEEPL')       byUser[log.userId].deepl  += log.chars
      else if (log.provider === 'OPENAI') byUser[log.userId].openai += log.chars
      else                                byUser[log.userId].claude += log.chars
    }

    // Busca nomes dos usuários
    const userIds = Object.keys(byUser)
    if (userIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
      for (const u of users) {
        if (byUser[u.id]) byUser[u.id].name = u.name
      }
    }

    // Estimativa de custo (aproximada)
    // DeepL Free: grátis até 500.000 chars/mês
    // Claude Haiku: ~$0.25/1M input tokens ≈ $0.00025/1k chars (aprox)
    // GPT-4o-mini: ~$0.15/1M input tokens ≈ $0.00015/1k chars (aprox)
    const deeplFreeLimit = 500_000
    const deeplUsedTotal = totals['DEEPL']?.chars ?? 0
    const claudeCostUSD  = ((totals['CLAUDE']?.chars ?? 0) / 1000) * 0.00025
    const openaiCostUSD  = ((totals['OPENAI']?.chars ?? 0) / 1000) * 0.00015

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      totals,
      byDay: Object.entries(byDay)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byUser: Object.entries(byUser)
        .map(([userId, v]) => ({ userId, ...v }))
        .sort((a, b) => (b.deepl + b.claude + b.openai) - (a.deepl + a.claude + a.openai)),
      estimates: {
        deeplFreeLimit,
        deeplUsedTotal,
        deeplUsedPercent: Math.round((deeplUsedTotal / deeplFreeLimit) * 100),
        claudeCostUSD:    parseFloat(claudeCostUSD.toFixed(4)),
        openaiCostUSD:    parseFloat(openaiCostUSD.toFixed(4)),
      },
    })
  } catch (error) {
    console.error('[GET /api/ai/usage]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
