import type { H3Event } from 'nitro/h3'
import { HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

import type { Resource } from '~/server/types'
import notion from '~/server/utils/notion'
import notionNormalizeId from '~/server/utils/notion-normalize-id'

type Relation = { relation?: { id: string }[] } | undefined

/** Verified by middleware/org-user.ts. */
export function getAuth(event: H3Event): { orgSlug: string; orgId: string; userId: string } {
  const auth = (event.context as { auth?: { orgSlug: string; orgId: string; userId: string } }).auth
  if (!auth) {
    throw new HTTPError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }
  return auth
}

const relationHas = (relation: Relation, key: string) => !!relation?.relation?.some((r) => notionNormalizeId(r.id) === key)

/** Notion ids (normalized) of the projects that belong to the caller's organization. */
export async function orgProjectKeys(event: H3Event): Promise<Set<string>> {
  const orgKey = notionNormalizeId(getAuth(event).orgId)
  const storage = useStorage<Resource<'project'>>('data:resource:project')
  const projects = (await storage.getItems(await storage.getKeys())).flatMap(({ value }) => value?.record || [])

  return new Set(projects.filter((p) => relationHas((p.properties as Record<string, any>).Organization, orgKey)).map((p) => notionNormalizeId(p.id)))
}

/** Returns the project when it belongs to the caller's organization; otherwise 404 (existence is not revealed). */
export async function assertProjectAccess(event: H3Event, projectId: string) {
  const key = notionNormalizeId(projectId)
  const project = (await useStorage<Resource<'project'>>('data:resource:project').getItem(key))?.record

  if (!project || !(await orgProjectKeys(event)).has(key)) {
    throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  return project
}

/**
 * Every media id must belong to the caller's organization, through its own Organization
 * relation or through its project. A file that is too new for the cache is read from Notion.
 */
export async function assertMediaAccess(event: H3Event, mediaIds: string[]): Promise<void> {
  const orgKey = notionNormalizeId(getAuth(event).orgId)
  const projectKeys = await orgProjectKeys(event)
  const mediaStorage = useStorage<Resource<'media'>>('data:resource:media')

  const belongs = (properties: Record<string, any>) =>
    relationHas(properties.Organization, orgKey) || !!(properties.Project as Relation)?.relation?.some((r) => projectKeys.has(notionNormalizeId(r.id)))

  for (const rawId of new Set(mediaIds)) {
    const key = notionNormalizeId(rawId)
    let properties = (await mediaStorage.getItem(key))?.record?.properties as Record<string, any> | undefined

    if (!properties) {
      const page = await notion.pages.retrieve({ page_id: key }).catch(() => null)
      properties = (page as { properties?: Record<string, any> } | null)?.properties
    }

    if (!properties || !belongs(properties)) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Media not found' })
    }
  }
}
