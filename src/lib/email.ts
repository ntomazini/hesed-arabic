/**
 * Email helper — uses Nodemailer with env-based SMTP config.
 * If SMTP is not configured, logs to console and returns gracefully.
 *
 * Required env vars (add to .env):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=seu@email.com
 *   SMTP_PASS=sua_senha_de_app
 *   SMTP_FROM="Hesed Arabic <noreply@hesed.com>"
 */

import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)

  if (!host || !user || !pass) return null

  return {
    from: process.env.SMTP_FROM ?? `Hesed Arabic <${user}>`,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
  }
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<{ ok: boolean; method: 'smtp' | 'log' }> {
  const cfg = getTransporter()
  if (!cfg) {
    console.log(`[EMAIL] SMTP não configurado — email NÃO enviado para ${to}`)
    console.log(`[EMAIL] Assunto: ${subject}`)
    return { ok: true, method: 'log' }
  }
  await cfg.transporter.sendMail({ from: cfg.from, to, subject, html, text })
  return { ok: true, method: 'smtp' }
}

export function buildResetSenhaEmail(name: string, resetLink: string) {
  const subject = 'Hesed Arabic — Redefinição de senha'
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;">
      <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:32px 32px 24px;text-align:center;">
        <div style="display:inline-block;background:white;border-radius:10px;padding:10px 18px;margin-bottom:16px;">
          <span style="color:#1e3a5f;font-weight:900;font-size:20px;letter-spacing:1px;">HA</span>
        </div>
        <h1 style="color:white;margin:0;font-size:22px;">Hesed Arabic</h1>
        <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">Bíblia EN→AR</p>
      </div>
      <div style="background:white;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e2e8f0;border-top:none;">
        <p style="color:#1e293b;font-size:16px;">Olá, <strong>${name}</strong>!</p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
          Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Hesed Arabic</strong>.
          Clique no botão abaixo para criar uma nova senha:
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}"
            style="background:#1e3a5f;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block;letter-spacing:0.3px;">
            Redefinir minha senha
          </a>
        </div>
        <p style="color:#64748b;font-size:13px;">
          Ou copie e cole este link no navegador:<br/>
          <a href="${resetLink}" style="color:#1e3a5f;word-break:break-all;">${resetLink}</a>
        </p>
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;">
          Este link é válido por <strong>1 hora</strong>. Se você não solicitou a redefinição de senha,
          ignore este email — sua senha não será alterada.
        </p>
      </div>
    </div>
  `
  const text = `Olá, ${name}!\n\nRecebemos uma solicitação para redefinir sua senha na Hesed Arabic.\n\nAcesse o link abaixo para criar uma nova senha (válido por 1 hora):\n${resetLink}\n\nSe você não solicitou isso, ignore este email.`
  return { subject, html, text }
}

export function buildSetupSenhaEmail(name: string, setupLink: string) {
  const subject = 'Bem-vindo(a) à Hesed Arabic — Configure seu acesso'
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;">
      <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:32px 32px 24px;text-align:center;">
        <div style="display:inline-block;background:white;border-radius:10px;padding:10px 18px;margin-bottom:16px;">
          <span style="color:#1e3a5f;font-weight:900;font-size:20px;letter-spacing:1px;">HA</span>
        </div>
        <h1 style="color:white;margin:0;font-size:22px;">Hesed Arabic</h1>
        <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">Bíblia EN→AR</p>
      </div>
      <div style="background:white;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e2e8f0;border-top:none;">
        <p style="color:#1e293b;font-size:16px;">Olá, <strong>${name}</strong>!</p>
        <p style="color:#475569;font-size:15px;line-height:1.6;">
          Você foi adicionado(a) à plataforma de tradução <strong>Hesed Arabic</strong>.
          Clique no botão abaixo para criar sua senha e ativar seu acesso:
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${setupLink}"
            style="background:#1e3a5f;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block;letter-spacing:0.3px;">
            Criar minha senha
          </a>
        </div>
        <p style="color:#64748b;font-size:13px;">
          Ou copie e cole este link no navegador:<br/>
          <a href="${setupLink}" style="color:#1e3a5f;word-break:break-all;">${setupLink}</a>
        </p>
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;">
          Este link é válido por 7 dias. Se você não solicitou este acesso, ignore este email.
        </p>
      </div>
    </div>
  `
  const text = `Olá, ${name}!\n\nVocê foi adicionado(a) à plataforma Hesed Arabic.\n\nAcesse o link abaixo para criar sua senha:\n${setupLink}\n\nEste link é válido por 7 dias.`
  return { subject, html, text }
}
