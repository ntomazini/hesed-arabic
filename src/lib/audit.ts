import { db } from './db'
import { AuditAction, Prisma } from '@prisma/client'

interface AuditParams {
  actorId: string
  actorEmail: string
  action: AuditAction
  targetId?: string
  targetDesc?: string
  metadata?: Record<string, unknown>
}

/**
 * Grava uma entrada no log de auditoria.
 * Erros sao suprimidos para nao interromper o fluxo principal.
 */
export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: params.action,
        targetId: params.targetId,
        targetDesc: params.targetDesc,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err)
  }
}
