import { defineEventHandler, getRouterParam, getValidatedQuery, HTTPError } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import type { Resource } from '~/server/types'
import notionNormalizeId from '~/server/utils/notion-normalize-id'
import notionTextStringify from '~/server/utils/notion-text-stringify'

const querySchema = z.object({
  status: z.enum(['plan', 'draft', 'approved', 'notApproved', 'release', 'archive']).optional(),
  sort: z.enum(['date_desc', 'date_asc']).default('date_desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
})

const statusMap = {
  plan: 'Plan',
  draft: 'Draft',
  approved: 'Approved',
  notApproved: 'Not Approved',
  release: 'Release',
  archive: 'Archive',
}

export default defineEventHandler(async (event) => {
  try {
    const projectId = notionNormalizeId(getRouterParam(event, 'projectId')!.toString().replace(/,$/, ''))

    const query = await getValidatedQuery(event, (data) => querySchema.parse(data))
    const { status, sort, page, limit } = query
    const offset = (page - 1) * limit

    const config = useRuntimeConfig()

    const mediaStorage = useStorage<Resource<'media'>>(`data:resource:media`)
    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)

    const project = await projectStorage.getItem(projectId)

    if (!project) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    const mediaKeys = await mediaStorage.getKeys()
    const allMedia = (await mediaStorage.getItems(mediaKeys)).flatMap(({ value }) => value?.record || [])

    let projectMedia = allMedia.filter(({ properties }) => properties['Project Slug']?.rollup?.array[0]?.formula?.string === project.record.properties.Slug.formula.string)

    if (status) {
      projectMedia = projectMedia.filter((a) => a.properties.Status?.status?.name?.toLowerCase() === statusMap[status].toLowerCase())
    }

    const totalItems = projectMedia.length

    const paginatedMedia = projectMedia.slice(offset, offset + limit)

    const formattedData = paginatedMedia.map(({ properties, cover, id }) => ({
      id: properties.Slug.formula.string,
      url: `${config.public.mediaUrl}/media/image/s_810x1080/${properties.Slug.formula.string}`, //cover?.type === 'external' ? cover.external.url : undefined,
      filename: notionTextStringify(properties.Name.title),
      status: properties.Status?.status?.name?.toLowerCase() || 'pending',
      type: properties.Type?.select?.name?.toLowerCase() || 'photo',
      metadata: {
        resolution: properties.Resolution?.select?.name,
        aspectRatio: properties['Aspect ratio']?.select?.name,
      },
    }))

    return {
      data: formattedData,
      totalItems,
    }
  } catch (error: any) {
    console.error('API [projectId]/media GET Error:', error)
    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
