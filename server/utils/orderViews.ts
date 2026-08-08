// What each party is shown about an order.
//
// Separate from the endpoint so the narrowing can be tested directly: the whole
// privacy rule of the orders page is a mapping function, and a mapping function
// nobody can call is a rule nobody can check.

import { itemTitles, type RequestItem } from '#shared/catalog'
import type { RequesterIdentity } from '#shared/identity'
import type { BookRequest } from './requests'

/** What you are shown about an order coming to you. */
export interface MineView {
  id: string
  items: RequestItem[]
  titles: string[]
  status: string
  shippingStatus?: string
  createdAt: string
  fulfilledAt?: string
}

/**
 * What a giver is shown about a request they paid for.
 *
 * Deliberately narrow. The row this is built from carries the recipient's legal
 * name, phone number and street address, none of which a giver has any business
 * seeing — they paid for a book, they did not buy a stranger's home address.
 * What is left is what the public board already shows them, plus where the
 * parcel has got to, which is what they came to find out.
 *
 * Built key by key rather than by deleting fields, so a field added to
 * `BookRequest` later does not appear here by default. That default is the
 * whole protection: the leak this prevents is not one anybody would write on
 * purpose, it is one that arrives by a column being added somewhere else.
 */
export interface GivenView {
  id: string
  items: RequestItem[]
  titles: string[]
  requesters: RequesterIdentity[]
  status: string
  shippingStatus?: string
  createdAt: string
  fulfilledAt?: string
}

export function toMineView(r: BookRequest): MineView {
  return {
    id: r.id,
    items: r.items,
    titles: itemTitles(r.items),
    status: r.status,
    shippingStatus: r.shippingStatus,
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt
  }
}

export function toGivenView(r: BookRequest): GivenView {
  return {
    id: r.id,
    items: r.items,
    titles: itemTitles(r.items),
    requesters: r.requesters,
    status: r.status,
    shippingStatus: r.shippingStatus,
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt
  }
}
