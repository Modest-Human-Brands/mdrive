import { defineEventHandler, getRouterParam, getValidatedQuery, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import type { Resource } from '~/server/types'
import notionTextStringify from '~/server/utils/notion-text-stringify'

const querySchema = z.object({
  status: z.enum(['plan', 'draft', 'approved', 'not approved', 'release']).optional(),
  sort: z.enum(['date_desc', 'date_asc']).default('date_desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
})

export default defineEventHandler(async (event) => {
  try {
    const projectId = getRouterParam(event, 'projectId')!.toString().replace(/,$/, '')

    const query = await getValidatedQuery(event, (data) => querySchema.parse(data))
    const { status, sort, page, limit } = query
    const offset = (page - 1) * limit

    const mediaStorage = useStorage<Resource<'media'>>(`data:resource:media`)
    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)

    const projectKeys = await projectStorage.getKeys()
    const projects = (await projectStorage.getItems(projectKeys)).flatMap(({ value }) => value?.record || [])
    const filteredProject = projects.find(({ properties }) => properties.Slug.formula.string === projectId)

    if (!filteredProject) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    const mediaKeys = await mediaStorage.getKeys()
    const allMedia = (await mediaStorage.getItems(mediaKeys)).flatMap(({ value }) => value?.record || [])

    let projectMedia = allMedia.filter((a) => a.properties['Project Slug']?.rollup?.array[0]?.formula?.string === filteredProject.properties.Slug.formula.string)

    if (status) {
      projectMedia = projectMedia.filter((a) => a.properties.Status?.status?.name?.toLowerCase() === status.toLowerCase())
    }

    const totalItems = projectMedia.length

    const paginatedMedia = projectMedia.slice(offset, offset + limit)

    const formattedData = paginatedMedia.map(({ properties, cover, id }) => ({
      mediaId: properties.Slug.formula.string || id,
      url: cover?.type === 'external' ? cover.external.url : undefined,
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
