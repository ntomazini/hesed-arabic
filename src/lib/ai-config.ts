// ── Configuração de Provedores de IA ──────────────────────────────────────────
// Lê/salva a ordem e o estado de cada provedor de IA em arquivo JSON local.
// Fallback para configuração padrão se o arquivo não existir.

import fs   from 'fs'
import path from 'path'

export type ProviderId = 'deepl' | 'openai' | 'claude'

export interface AiProviderConfig {
  id:      ProviderId
  name:    string
  enabled: boolean
}

export interface AiConfig {
  providers: AiProviderConfig[]
}

const DEFAULT_CONFIG: AiConfig = {
  providers: [
    { id: 'deepl',  name: 'DeepL',                 enabled: false }, // DeepL não suporta árabe
    { id: 'openai', name: 'OpenAI (GPT-4o-mini)',   enabled: false }, // desativado por padrão
    { id: 'claude', name: 'Claude (Sonnet)',         enabled: true  }, // principal para EN→AR
  ],
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'ai-config.json')

export function getAiConfig(): AiConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as AiConfig
      // Garante que todos os provedores padrão estejam presentes
      const ids = parsed.providers.map(p => p.id)
      for (const def of DEFAULT_CONFIG.providers) {
        if (!ids.includes(def.id)) parsed.providers.push({ ...def })
      }
      return parsed
    }
  } catch {
    // ignora erro — usa padrão
  }
  return { providers: DEFAULT_CONFIG.providers.map(p => ({ ...p })) }
}

export function saveAiConfig(config: AiConfig): void {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

/** Retorna quais chaves de API estão configuradas (sem expor o valor) */
export function getApiKeyStatus(): Record<ProviderId, boolean> {
  return {
    deepl:  !!process.env.DEEPL_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
  }
}
