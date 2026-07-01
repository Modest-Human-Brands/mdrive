import { defineEventHandler, getValidatedQuery, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import type { Resource } from '~/server/types'
import notionTextStringify from '~/server/utils/notion-text-stringify'

const querySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(100),
})

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, (data) => querySchema.parse(data))
    const { status, search, page, limit } = query
    const offset = (page - 1) * limit

    const mediaStorage = useStorage<Resource<'media'>>(`data:resource:media`)
    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)
    const clientStorage = useStorage<Resource<'client'>>(`data:resource:client`)

    const [mediaKeys, projectKeys, clientKeys] = await Promise.all([mediaStorage.getKeys(), projectStorage.getKeys(), clientStorage.getKeys()])

    const [rawMedia, rawProjects, rawClients] = await Promise.all([mediaStorage.getItems(mediaKeys), projectStorage.getItems(projectKeys), clientStorage.getItems(clientKeys)])

    function filterByOrg<T>(
      items: {
        key: string
        value?: {
          record?: T // <T> represents whatever your resource type actually is
        } | null
      }[],
      activeOrg?: string
    ): T[] {
      return items.flatMap(({ value }) => (value?.record ? [value.record] : []))
      // .filter((item: any) =>
      //   // We use 'any' here to bypass TS checking for 'Organization'
      //   item?.properties?.Organization?.relation?.some(
      //     (rel: any) => rel.id === activeOrg
      //   )
      // );
    }

    const projects = filterByOrg(rawProjects)
    const medias = filterByOrg(rawMedia)
    const clients = filterByOrg(rawClients)

    let mappedProjects = projects.map((p) => {
      const props = p.properties
      const projectSlug = props?.Slug?.formula?.string || p.id

      const projectAssets = medias.filter((asset) => asset.properties?.['Project Slug']?.rollup?.array?.[0]?.formula?.string === projectSlug)

      const photoCount = projectAssets.filter((a) => a.properties?.Type?.select?.name?.toLowerCase() === 'photo').length
      const videoCount = projectAssets.filter((a) => a.properties?.Type?.select?.name?.toLowerCase() === 'video').length

      const clientId = props?.Client?.relation?.[0]?.id
      const projectClient = clients.find((c) => c.id === clientId)

      return {
        id: p.id,
        slug: projectSlug,
        title: notionTextStringify(props?.Name?.title) || 'Untitled Project',
        date: props?.Date?.date?.start || new Date(p.created_time || 0).toISOString(),
        status: props?.Status?.status?.name || 'Draft',
        client: projectClient
          ? {
              name: notionTextStringify(projectClient.properties?.Name?.title) || 'Unknown Client',
              avatar: projectClient.cover?.type === 'external' ? projectClient.cover.external.url : undefined,
            }
          : undefined,
        mediaCount: {
          photo: photoCount,
          video: videoCount,
        },
        previewImages: projectAssets
          .map(({ properties }) => properties.Slug.formula.string)
          .filter(Boolean)
          .slice(0, 4),
      }
    })

    if (search) {
      const q = search.toLowerCase()
      mappedProjects = mappedProjects.filter((p) => p.title.toLowerCase().includes(q) || p.client?.name?.toLowerCase().includes(q))
    }

    if (status) {
      mappedProjects = mappedProjects.filter((p) => p.status.toLowerCase() === status.toLowerCase())
    }

    mappedProjects.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const totalItems = mappedProjects.length
    const paginatedData = mappedProjects.slice(offset, offset + limit)

    return {
      data: paginatedData,
      totalItems,
    }
  } catch (error: any) {
    console.error('API /projects GET Error:', error)
    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
