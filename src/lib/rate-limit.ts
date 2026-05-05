import { redis } from './redis'
import { NextResponse } from 'next/server'

interface RateLimitOptions {
  /** Identificador unico da janela (ex: userId + endpoint) */
  key: string
  /** Maximo de requisicoes na janela */
  limit: number
  /** Duracao da janela em segundos */
  windowSec: number
}

/**
 * Sliding-window rate limiter usando Redis INCR + EXPIRE.
 * Retorna null se OK, ou um NextResponse 429 se o limite foi atingido.
 */
export async function rateLimit({ key, limit, windowSec }: RateLimitOptions): Promise<NextResponse | null> {
  try {
    const redisKey = `rl:${key}`
    const current = await redis.incr(redisKey)
    if (current === 1) {
      // Primeira requisicao na janela — define o TTL
      await redis.expire(redisKey, windowSec)
    }
    if (current > limit) {
      const ttl = await redis.ttl(redisKey)
      return NextResponse.json(
        { error: `Muitas requisições. Tente novamente em ${ttl}s.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(ttl > 0 ? ttl : windowSec),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }
    return null
  } catch {
    // Se o Redis estiver indisponivel, deixa passar (fail open)
    return null
  }
}

// ── Limites pre-configurados por contexto ─────────────────────────────────────

/** Autenticacao / login — 10 tentativas/min por IP */
export function rateLimitAuth(ip: string) {
  return rateLimit({ key: `auth:${ip}`, limit: 10, windowSec: 60 })
}

/** Acoes de mutacao de usuarios (criar, editar, resetar senha) — 20/min por usuario */
export function rateLimitUserMutation(userId: string) {
  return rateLimit({ key: `user-mut:${userId}`, limit: 20, windowSec: 60 })
}

/** Traducao automatica por IA — 60/min por usuario (DeepL Free: 500k chars/mes) */
export function rateLimitTranslate(userId: string) {
  return rateLimit({ key: `translate:${userId}`, limit: 60, windowSec: 60 })
}

/** Acoes de mutacao de projetos — 30/min por usuario */
export function rateLimitProjectMutation(userId: string) {
  return rateLimit({ key: `proj-mut:${userId}`, limit: 30, windowSec: 60 })
}

/** Salvar segmentos (digitacao intensa) — 120/min por usuario */
export function rateLimitSegment(userId: string) {
  return rateLimit({ key: `segment:${userId}`, limit: 120, windowSec: 60 })
}
