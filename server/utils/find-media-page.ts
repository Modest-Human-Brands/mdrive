import { useStorage } from 'nitro/storage'

import type { Resource } from '~/server/types'
import notion from '~/server/utils/notion'
import notionNormalizeId from '~/server/utils/notion-normalize-id'
import notionQueryDb from '~/server/utils/notion-query-db'

/**
 * Finds the Notion media page for a project, media index and version index.
 * Checks the synced cache first, then asks Notion (the cache can lag behind a fresh upload).
 */
export default async function findMediaPage(projectPageId: string, mediaDataSourceId: string, mediaIndex: number, versionIndex: number): Promise<string | null> {
  const projectKey = notionNormalizeId(projectPageId)

  const mediaStorage = useStorage<Resource<'media'>>('data:resource:media')
  const cached = (await mediaStorage.getItems(await mediaStorage.getKeys())).flatMap(({ value }) => value?.record || [])

  const hit = cached.find((m) => {
    const props = m.properties as Record<string, any>
    return props.Index?.number === mediaIndex && props['Version Index']?.number === versionIndex && props.Project?.relation?.some((r: { id: string }) => notionNormalizeId(r.id) === projectKey)
  })
  if (hit) return hit.id

  const found = await notionQueryDb<{ id: string }>(notion, mediaDataSourceId, {
    filter: {
      and: [
        { property: 'Project', relation: { contains: projectPageId } },
        { property: 'Index', number: { equals: mediaIndex } },
        { property: 'Version Index', number: { equals: versionIndex } },
      ],
    },
  })

  return found[0]?.id ?? null
}
