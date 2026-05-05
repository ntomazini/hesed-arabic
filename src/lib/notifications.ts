import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import type { NotifType } from '@prisma/client'

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

// ── Template de email para notificações de workflow ───────────────────────────

function buildWorkflowEmail(params: {
  recipientName: string
  title: string
  message: string
  link?: string
  linkLabel?: string
}) {
  const { recipientName, title, message, link, linkLabel = 'Ver na plataforma' } = params

  const btnHtml = link
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${BASE_URL}${link}"
          style="background:#1e3a5f;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;display:inline-block;">
          ${linkLabel}
        </a>
      </div>`
    : ''

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;">
      <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
        <span style="color:white;font-weight:900;font-size:18px;letter-spacing:1px;">HT</span>
        <span style="color:#93c5fd;font-size:14px;margin-left:10px;">Hesed Translation</span>
      </div>
      <div style="background:white;border-radius:0 0 12px 12px;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;">
        <p style="color:#1e293b;font-size:15px;">Olá, <strong>${recipientName}</strong>!</p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">${message}</p>
        ${btnHtml}
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;" />
        <p style="color:#94a3b8;font-size:12px;">
          Você está recebendo este email porque tem notificações ativadas na plataforma Hesed Translation.
        </p>
      </div>
    </div>
  `
  const text = `Olá, ${recipientName}!\n\n${message}${link ? `\n\nAcesse: ${BASE_URL}${link}` : ''}`
  return { subject: `[Hesed Translation] ${title}`, html, text }
}

// ── Criar notificação + enviar email opcionalmente ────────────────────────────

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  sendEmailNotification = true,
}: {
  userId: string
  type: NotifType
  title: string
  message: string
  link?: string
  sendEmailNotification?: boolean
}) {
  try {
    // Cria notificação interna
    await db.notification.create({
      data: { userId, type, title, message, link: link ?? null },
    })

    // Envia email se solicitado
    if (sendEmailNotification) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, active: true },
      })
      if (user?.active && user.email) {
        const emailContent = buildWorkflowEmail({
          recipientName: user.name,
          title,
          message,
          link,
        })
        // Disparo sem await para não bloquear o fluxo principal
        sendEmail({ to: user.email, ...emailContent }).catch(() => {})
      }
    }
  } catch {
    // Nunca deixar erros de notificação quebrar o fluxo principal
  }
}
