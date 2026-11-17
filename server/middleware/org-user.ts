import { defineEventHandler, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

import type { Resource } from '~/server/types'
import notionNormalizeId from '~/server/utils/notion-normalize-id'

/** Routes that need an API key but no org or user: health and the server-to-server webhook. */
const PROTECTED_PREFIX = '/api/'
const PUBLIC_PATHS = new Set(['/api/health'])

/** Member statuses that grant access. Unfilled, Filled and Inactive do not. */
const ALLOWED_STATUSES = new Set(['verified', 'active'])

const HEX_ID = /^[\da-f]{32}$/

/**
 * Runs after the API key check (api-key.ts, alphabetical order).
 * Every /api/** call must name an organization (`x-org-id`, its slug) and a user (`x-user-id`,
 * the Notion User page id), and that user must be a Verified or Active member of that organization.
 * The verified ids are placed on `event.context.auth` for handlers.
 */
export default defineEventHandler(async (event) => {
  const { pathname } = event.url

  if (event.req.method === 'OPTIONS' || PUBLIC_PATHS.has(pathname) || !pathname.startsWith(PROTECTED_PREFIX)) {
    return
  }

  const orgSlug = event.req.headers.get('x-org-id')?.trim()
  if (!orgSlug) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'Missing x-org-id header' })
  }

  const rawUserId = event.req.headers.get('x-user-id')?.trim()
  if (!rawUserId) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'Missing x-user-id header' })
  }

  const userId = notionNormalizeId(rawUserId).toLowerCase()
  if (!HEX_ID.test(userId)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'x-user-id must be a Notion page id' })
  }

  const orgStorage = useStorage<Resource<'organization'>>('data:resource:organization')
  const orgs = (await orgStorage.getItems(await orgStorage.getKeys())).flatMap(({ value }) => value?.record || [])
  const org = orgs.find((o) => o.properties?.Id?.rich_text?.[0]?.text?.content === orgSlug)

  if (!org) {
    throw new HTTPError({ statusCode: 403, statusMessage: 'Unknown organization' })
  }

  const orgKey = notionNormalizeId(org.id)
  const memberStorage = useStorage<Resource<'member'>>('data:resource:member')
  const members = (await memberStorage.getItems(await memberStorage.getKeys())).flatMap(({ value }) => value?.record || [])

  const isMember = members.some(
    (m) =>
      ALLOWED_STATUSES.has(m.properties?.Status?.status?.name?.toLowerCase() ?? '') &&
      m.properties?.Organization?.relation?.some((r) => notionNormalizeId(r.id) === orgKey) &&
      m.properties?.User?.relation?.some((r) => notionNormalizeId(r.id).toLowerCase() === userId)
  )

  if (!isMember) {
    throw new HTTPError({ statusCode: 403, statusMessage: 'User is not a verified or active member of this organization' })
  }

  event.context.auth = { orgSlug, orgId: org.id, userId }
})
