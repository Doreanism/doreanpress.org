// Transactional email via Resend (https://resend.com) over its HTTP API — no
// SDK dependency. When `resendApiKey` is unset, emails are logged to the console
// instead of sent, so the pay-it-forward loop works without credentials.

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

interface EmailConfig {
  apiKey: string
  from: string
  pressEmail: string
  mock: boolean
}

function resolveConfig(): EmailConfig {
  const cfg = useRuntimeConfig()
  const apiKey = cfg.resendApiKey || ''
  return {
    apiKey,
    from: cfg.fromEmail || 'Dorean Press <hello@doreanpress.org>',
    pressEmail: cfg.pressEmail || '',
    mock: !apiKey
  }
}

export function pressEmailAddress(): string {
  return resolveConfig().pressEmail
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const cfg = resolveConfig()

  if (!message.to) return

  if (cfg.mock) {
    console.info(`[email:mock] → ${message.to} | ${message.subject}\n${message.text}\n`)
    return
  }

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        from: cfg.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text
      }
    })
  } catch (err) {
    // Never let an email failure break the request/fulfilment flow.
    console.error(`[email] failed to send "${message.subject}" to ${message.to}:`, err)
  }
}

// ── Templates ────────────────────────────────────────────────────────────

const SIGNATURE = 'Dorean Press · “Freely you have received; freely give.”'

function layout(body: string): string {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.6">
${body}
<hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0" />
<p style="font-size:13px;color:#78716c;font-style:italic">${SIGNATURE}</p>
</div>`
}

export function requestConfirmationEmail(params: { to: string, name: string, bookTitle: string }): EmailMessage {
  const { to, name, bookTitle } = params
  const text = `Hi ${name},

Your request for "${bookTitle}" is now on the Dorean Press "Give a Book" board. When another reader chooses to sponsor it, we'll print a copy and ship it to you — and we'll email you the moment that happens.

Thank you for letting the community give freely.

${SIGNATURE}`
  return {
    to,
    subject: `Your request for “${bookTitle}” is posted`,
    text,
    html: layout(`<p>Hi ${name},</p>
<p>Your request for <strong>“${bookTitle}”</strong> is now on the Dorean Press <em>Give a Book</em> board. When another reader chooses to sponsor it, we’ll print a copy and ship it to you — and we’ll email you the moment that happens.</p>
<p>Thank you for letting the community give freely.</p>`)
  }
}

export function requestFulfilledEmail(params: { to: string, name: string, bookTitle: string, city?: string }): EmailMessage {
  const { to, name, bookTitle, city } = params
  const dest = city ? ` to ${city}` : ''
  const text = `Hi ${name},

Good news — a reader has sponsored your copy of "${bookTitle}". It’s being printed on demand and shipped${dest} now. Please allow some time for printing and delivery.

Freely you have received; freely give.

${SIGNATURE}`
  return {
    to,
    subject: `Someone sponsored your copy of “${bookTitle}”`,
    text,
    html: layout(`<p>Hi ${name},</p>
<p>Good news — a reader has <strong>sponsored your copy</strong> of “${bookTitle}”. It’s being printed on demand and shipped${dest} now. Please allow some time for printing and delivery.</p>
<p><em>Freely you have received; freely give.</em></p>`)
  }
}

export function sponsorThankYouEmail(params: { to: string, bookTitle: string }): EmailMessage {
  const { to, bookTitle } = params
  const text = `Thank you.

Because of your gift, a copy of "${bookTitle}" is on its way to a reader who asked for one. You've helped keep the gospel freely given.

With gratitude,
${SIGNATURE}`
  return {
    to,
    subject: `Thank you for giving “${bookTitle}”`,
    text,
    html: layout(`<p>Thank you.</p>
<p>Because of your gift, a copy of <strong>“${bookTitle}”</strong> is on its way to a reader who asked for one. You’ve helped keep the gospel freely given.</p>
<p>With gratitude,</p>`)
  }
}

export function pressNewRequestEmail(params: { to: string, name: string, bookTitle: string, message: string }): EmailMessage {
  const { to, name, bookTitle, message } = params
  const text = `New request on the Give a Book board.

Book: ${bookTitle}
From: ${name}
Message: ${message}`
  return {
    to,
    subject: `New request: “${bookTitle}”`,
    text,
    html: layout(`<p><strong>New request on the Give a Book board.</strong></p>
<p><strong>Book:</strong> ${bookTitle}<br/>
<strong>From:</strong> ${name}</p>
<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#57534e">${message}</blockquote>`)
  }
}
