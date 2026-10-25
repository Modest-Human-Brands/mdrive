import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { defineTask } from 'nitro/task'
import pThrottle from 'p-throttle'
import pRetry, { AbortError } from 'p-retry'

import type { NotionDB } from '~/server/types'
import notion from '~/server/utils/notion'
import notionNormalizeId from '~/server/utils/notion-normalize-id'
import notionQueryDb from '~/server/utils/notion-query-db'

const throttle = pThrottle({
  limit: 2,
  interval: 1000,
})

const throttledNotion = throttle((task: () => Promise) =>
  pRetry(task, {
    retries: 3,
    onFailedAttempt: (error: any) => {
      const isRateLimited = error?.status === 429 || error?.code === 'rate_limited'
      if (!isRateLimited) throw new AbortError(error)
    },
  })
) as (task: () => Promise) => Promise

export default defineTask({
  meta: {
    name: 'sync:resource',
    description: 'Sync Notion Resources into cache',
  },
  async run() {
    const startTime = Date.now()
    console.info('[sync:resource] Starting resource synchronization...')

    const config = useRuntimeConfig()
    const rawDbId = config.private.notionDbId
    const notionDbId = (typeof rawDbId === 'string' ? JSON.parse(rawDbId) : rawDbId) as unknown as NotionDB

    const dbEntries = [
      { type: 'organization', fn: () => notionQueryDb(notion, notionDbId.organization) },
      // { type: 'user', fn: () => notionQueryDb(notion, notionDbId.user) },
      { type: 'contact', fn: () => notionQueryDb(notion, notionDbId.contact) },
      { type: 'project', fn: () => notionQueryDb(notion, notionDbId.project) },
      // { type: 'document', fn: () => notionQueryDb(notion, notionDbId.document) },
      // { type: 'stream', fn: () => notionQueryDb(notion, notionDbId.stream) },
      { type: 'media', fn: () => notionQueryDb(notion, notionDbId.media) },
    ] as const

    const results = await Promise.allSettled(dbEntries.map(({ fn }) => throttledNotion(fn)))

    for (const [idx, res] of results.entries()) {
      const { type } = dbEntries[idx]
      const resourceStorage = useStorage(`data:resource:${type}`)

      if (res.status === 'fulfilled') {
        const records = (res.value as any[]).filter(Boolean)

        await Promise.allSettled(
          records.map(async (record) => {
            if (typeof record === 'string' || !record?.id) return

            const normalizedId = notionNormalizeId(record.id)
            const resource = (await resourceStorage.getItem(normalizedId)) ?? {
              type,
              notificationStatus: false,
              record,
            }

            resource.record = record
            await resourceStorage.setItem(normalizedId, resource)
          })
        )
      } else {
        console.warn(`Notion fetch failed for ${type}:`, res.reason)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.info(`[sync:resource] Completed synchronization in ${duration}s`)
    return { result: 'success', duration: `${duration}s` }
  },
})
