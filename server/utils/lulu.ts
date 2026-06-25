// Minimal Lulu Print API client.
//
// Docs: https://developers.lulu.com/
// Auth is OAuth2 client-credentials; print jobs require print-ready interior +
// cover PDFs reachable by URL and a POD package id describing the physical book.
//
// When credentials are absent or `lulu.mock` is "true", every method returns a
// realistic mock so the rest of the app (checkout, fulfilment) works end-to-end
// without contacting Lulu.

export interface LuluShippingAddress {
  name: string
  street1: string
  street2?: string
  city: string
  state_code?: string
  country_code: string
  postcode: string
  phone_number: string
  email?: string
}

export interface LuluLineItem {
  externalId: string
  title: string
  podPackageId: string
  pageCount: number
  interiorPdfUrl: string
  coverPdfUrl: string
  quantity: number
}

export type ShippingLevel = 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS'

export interface CreatePrintJobInput {
  externalId: string
  shippingAddress: LuluShippingAddress
  lineItems: LuluLineItem[]
  shippingLevel?: ShippingLevel
}

interface LuluConfig {
  clientKey: string
  clientSecret: string
  baseUrl: string
  contactEmail: string
  mock: boolean
}

function resolveConfig(): LuluConfig {
  const cfg = useRuntimeConfig().lulu
  const clientKey = cfg.clientKey || ''
  const clientSecret = cfg.clientSecret || ''
  const mock = cfg.mock === 'true' || cfg.mock === true || !clientKey || !clientSecret
  return {
    clientKey,
    clientSecret,
    baseUrl: (cfg.baseUrl || 'https://api.sandbox.lulu.com').replace(/\/$/, ''),
    contactEmail: cfg.contactEmail || 'orders@doreanpress.org',
    mock
  }
}

// Cache the OAuth token in module scope across requests.
let tokenCache: { token: string, expiresAt: number } | null = null

async function getAccessToken(cfg: LuluConfig): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token
  }

  const basic = Buffer.from(`${cfg.clientKey}:${cfg.clientSecret}`).toString('base64')
  const res = await $fetch<{ access_token: string, expires_in: number }>(
    `${cfg.baseUrl}/auth/realms/glasstree/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    }
  )

  tokenCache = {
    token: res.access_token,
    expiresAt: now + res.expires_in * 1000
  }
  return res.access_token
}

function buildLineItems(items: LuluLineItem[]) {
  return items.map(li => ({
    external_id: li.externalId,
    title: li.title,
    printable_normalization: {
      cover: { source_url: li.coverPdfUrl },
      interior: { source_url: li.interiorPdfUrl },
      pod_package_id: li.podPackageId
    },
    quantity: li.quantity
  }))
}

export function isLuluMocked(): boolean {
  return resolveConfig().mock
}

/**
 * Create a Lulu print job. The job is created in DRAFT/CREATED state; payment to
 * Lulu and production are handled in the Lulu dashboard or via further API calls.
 */
export async function createPrintJob(input: CreatePrintJobInput) {
  const cfg = resolveConfig()
  const shippingLevel = input.shippingLevel ?? 'MAIL'

  if (cfg.mock) {
    return {
      mock: true,
      id: `mock-${input.externalId}`,
      status: { name: 'CREATED' },
      external_id: input.externalId,
      shipping_level: shippingLevel,
      line_items: input.lineItems
    }
  }

  const token = await getAccessToken(cfg)
  return await $fetch(`${cfg.baseUrl}/print-jobs/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: {
      external_id: input.externalId,
      contact_email: cfg.contactEmail,
      shipping_level: shippingLevel,
      shipping_address: input.shippingAddress,
      line_items: buildLineItems(input.lineItems)
    }
  })
}

/**
 * Calculate Lulu print + shipping cost for a set of line items shipped to an
 * address. Useful if you later want to charge exact shipping at checkout.
 */
export async function calculatePrintCost(params: {
  lineItems: { podPackageId: string, pageCount: number, quantity: number }[]
  shippingAddress: Pick<LuluShippingAddress, 'city' | 'country_code' | 'postcode' | 'state_code' | 'street1' | 'name' | 'phone_number'>
  shippingLevel?: ShippingLevel
}) {
  const cfg = resolveConfig()
  const shippingLevel = params.shippingLevel ?? 'MAIL'

  if (cfg.mock) {
    const units = params.lineItems.reduce((n, li) => n + li.quantity, 0)
    const printCost = units * 4.5
    const shipping = 4.99
    return {
      mock: true,
      total_cost_incl_tax: (printCost + shipping).toFixed(2),
      shipping_cost: { total_cost_incl_tax: shipping.toFixed(2) },
      currency: 'USD'
    }
  }

  const token = await getAccessToken(cfg)
  return await $fetch(`${cfg.baseUrl}/print-job-cost-calculations/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: {
      line_items: params.lineItems.map(li => ({
        pod_package_id: li.podPackageId,
        page_count: li.pageCount,
        quantity: li.quantity
      })),
      shipping_address: params.shippingAddress,
      shipping_level: shippingLevel
    }
  })
}
