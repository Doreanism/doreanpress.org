// Transactional email via Resend (https://resend.com) over its HTTP API — no
// SDK dependency. When `resendApiKey` is unset, emails are logged to the console
// instead of sent, so the pay-it-forward loop works without credentials.

import { summarizeTitles } from '#shared/catalog'
import { describeIdentity, type RequesterIdentity } from '#shared/identity'

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

// A request is a whole order, so every template below takes the list of titles
// it covers. These helpers keep one title reading naturally ("your copy of
// “X”") while several read as an order, without branching in each template.

/** Titles as prose with typographic quotes: '“A”', '“A” and “B”'. */
function quoted(titles: string[]): string {
  return summarizeTitles(titles.map(t => `“${t}”`))
}

/** Plain-text variant, for the text/plain part. */
function quotedPlain(titles: string[]): string {
  return summarizeTitles(titles.map(t => `"${t}"`))
}

/** 'your copy of “A”' vs 'your order of 3 books' — subject-line friendly. */
function orderNoun(titles: string[]): string {
  return titles.length === 1 ? `your copy of “${titles[0]}”` : `your order of ${titles.length} books`
}

/** '<li>' list of every title in the order, or nothing for a single title. */
function titleList(titles: string[]): string {
  if (titles.length <= 1) return ''
  return `<ul style="padding-left:18px">${titles.map(t => `<li>${t}</li>`).join('')}</ul>`
}

export function requestConfirmationEmail(params: { to: string, name: string, titles: string[], withdrawUrl?: string }): EmailMessage {
  const { to, name, titles, withdrawUrl } = params
  const many = titles.length > 1
  const what = many ? 'Your request' : `Your request for ${quotedPlain(titles)}`
  const listText = many ? `\n\n${titles.map(t => `  · ${t}`).join('\n')}` : ''
  const text = `Hi ${name},

${what} is now on the Dorean Press "Give a Book" board.${listText}

When another reader chooses to sponsor it, we'll print ${many ? 'these books' : 'a copy'} and ship ${many ? 'them' : 'it'} to you together — and we'll email you the moment that happens.

Thank you for letting the community give freely.${withdrawUrl
  ? `

Changed your mind? You can remove your request here (before anyone sponsors it):
${withdrawUrl}`
  : ''}

${SIGNATURE}`
  return {
    to,
    subject: many ? `Your book request is posted (${titles.length} books)` : `Your request for ${quoted(titles)} is posted`,
    text,
    html: layout(`<p>Hi ${name},</p>
<p>${many ? '<strong>Your request</strong>' : `Your request for <strong>${quoted(titles)}</strong>`} is now on the Dorean Press <em>Give a Book</em> board.</p>${titleList(titles)}
<p>When another reader chooses to sponsor it, we’ll print ${many ? 'these books' : 'a copy'} and ship ${many ? 'them' : 'it'} to you together — and we’ll email you the moment that happens.</p>
<p>Thank you for letting the community give freely.</p>${withdrawUrl
  ? `
<p style="font-size:14px;color:#78716c">Changed your mind? You can <a href="${withdrawUrl}" style="color:#78716c">remove your request</a> any time before someone sponsors it.</p>`
  : ''}`)
  }
}

// A sponsor may cover only part of a request, so `titles` is what was funded and
// `remainingTitles` is whatever is still waiting on the board.
export function requestFulfilledEmail(params: {
  to: string
  name: string
  titles: string[]
  remainingTitles?: string[]
  city?: string
}): EmailMessage {
  const { to, name, titles, city } = params
  const remaining = params.remainingTitles ?? []
  const partial = remaining.length > 0
  const many = titles.length > 1
  const dest = city ? ` to ${city}` : ''
  const listText = many ? `\n\n${titles.map(t => `  · ${t}`).join('\n')}` : ''
  const sponsored = partial
    ? `part of your request — ${quotedPlain(titles)}`
    : many ? 'your whole request' : `your copy of ${quotedPlain(titles)}`
  const sponsoredHtml = partial
    ? `part of your request — ${quoted(titles)}`
    : many ? 'your whole request' : `your copy of ${quoted(titles)}`
  const stillWaiting = partial
    ? `\n\n${remaining.length === 1 ? quotedPlain(remaining) : `The rest of your request (${quotedPlain(remaining)})`} ${remaining.length === 1 ? 'is' : 'are'} still on the board, waiting for another sponsor. We’ll email you again when someone covers ${remaining.length === 1 ? 'it' : 'them'}.`
    : ''
  const text = `Hi ${name},

Good news — a reader has sponsored ${sponsored}.${listText}

${many ? 'The books are' : 'It’s'} being printed on demand and shipped${dest} now, together in one parcel. Please allow some time for printing and delivery.${stillWaiting}

Freely you have received; freely give.

${SIGNATURE}`
  return {
    to,
    // No count in the partial subject: one title can be split across what was
    // funded and what is still waiting, so "N of M" would be misleading.
    subject: partial
      ? 'Someone sponsored part of your request'
      : many ? `Someone sponsored your request (${titles.length} books)` : `Someone sponsored ${orderNoun(titles)}`,
    text,
    html: layout(`<p>Hi ${name},</p>
<p>Good news — a reader has <strong>sponsored ${sponsoredHtml}</strong>.</p>${titleList(titles)}
<p>${many ? 'The books are' : 'It’s'} being printed on demand and shipped${dest} now, together in one parcel. Please allow some time for printing and delivery.</p>${partial
  ? `
<p>${remaining.length === 1 ? quoted(remaining) : `The rest of your request (${quoted(remaining)})`} ${remaining.length === 1 ? 'is' : 'are'} still on the board, waiting for another sponsor. We’ll email you again when someone covers ${remaining.length === 1 ? 'it' : 'them'}.</p>`
  : ''}
<p><em>Freely you have received; freely give.</em></p>`)
  }
}

export function requestShippedEmail(params: { to: string, name: string, titles: string[], trackingUrl?: string }): EmailMessage {
  const { to, name, titles, trackingUrl } = params
  const many = titles.length > 1
  const listText = many ? `\n\n${titles.map(t => `  · ${t}`).join('\n')}` : ''
  const text = `Hi ${name},

${many ? 'Your order has' : `Your copy of ${quotedPlain(titles)} has`} shipped and is on its way to you.${listText}${trackingUrl
  ? `

Track your package here:
${trackingUrl}`
  : ''}

Freely you have received; freely give.

${SIGNATURE}`
  return {
    to,
    subject: `${many ? 'Your order' : `Your copy of ${quoted(titles)}`} has shipped`,
    text,
    html: layout(`<p>Hi ${name},</p>
<p>${many ? '<strong>Your order</strong>' : `Your copy of <strong>${quoted(titles)}</strong>`} has shipped and is on its way to you.</p>${titleList(titles)}${trackingUrl
  ? `
<p><a href="${trackingUrl}">Track your package</a></p>`
  : ''}
<p><em>Freely you have received; freely give.</em></p>`)
  }
}

export function sponsorThankYouEmail(params: { to: string, titles: string[] }): EmailMessage {
  const { to, titles } = params
  const many = titles.length > 1
  const listText = many ? `\n\n${titles.map(t => `  · ${t}`).join('\n')}` : ''
  const text = `Thank you.

Because of your gift, ${many ? `${titles.length} books are` : `a copy of ${quotedPlain(titles)} is`} on its way to a reader who asked for ${many ? 'them' : 'one'}.${listText}

You've helped keep the gospel freely given.

With gratitude,
${SIGNATURE}`
  return {
    to,
    subject: many ? `Thank you for giving ${titles.length} books` : `Thank you for giving ${quoted(titles)}`,
    text,
    html: layout(`<p>Thank you.</p>
<p>Because of your gift, ${many ? `<strong>${titles.length} books</strong> are` : `a copy of <strong>${quoted(titles)}</strong> is`} on its way to a reader who asked for ${many ? 'them' : 'one'}.</p>${titleList(titles)}
<p>You’ve helped keep the gospel freely given.</p>
<p>With gratitude,</p>`)
  }
}

// `requester` is the account the reader signed in with, included so the press
// can spot a pattern of abuse across postings that the shipping name alone
// would hide.
export function pressNewRequestEmail(params: { to: string, name: string, titles: string[], message: string, requester?: RequesterIdentity | null }): EmailMessage {
  const { to, name, titles, message, requester } = params
  const account = describeIdentity(requester)
  const text = `New request on the Give a Book board.

${titles.length > 1 ? `Books:\n${titles.map(t => `  · ${t}`).join('\n')}` : `Book: ${titles[0] ?? '(unknown)'}`}
From: ${name}
Account: ${account}${requester?.profileUrl ? `\n${requester.profileUrl}` : ''}
Message: ${message}`
  return {
    to,
    subject: titles.length > 1 ? `New request: ${titles.length} books` : `New request: ${quoted(titles)}`,
    text,
    html: layout(`<p><strong>New request on the Give a Book board.</strong></p>
<p><strong>${titles.length > 1 ? 'Books' : 'Book'}:</strong> ${summarizeTitles(titles)}<br/>
<strong>From:</strong> ${name}<br/>
<strong>Account:</strong> ${requester?.profileUrl ? `<a href="${requester.profileUrl}">${account}</a>` : account}</p>
<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#57534e">${message}</blockquote>`)
  }
}
