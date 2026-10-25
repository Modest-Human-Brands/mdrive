import { defineEventHandler, readValidatedBody, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import type { NotionMedia, Resource } from '~/server/types'
import notionNormalizeId from '~/server/utils/notion-normalize-id'
import r2Drive from '~/server/utils/r2-drive'
import notionTextStringify from '~/server/utils/notion-text-stringify'

import r2GetPresignedDownloadUrl from '~/server/utils/r2-get-presigned-download-url'

const downloadSchema = z
  .object({
    orgId: z.string(),
    projectId: z.string(),
    mediaIds: z.array(z.string()).optional(),
    params: z
      .object({
        version: z.string().optional(),
        status: z.enum(['plan', 'pending', 'approved', 'rejected', 'release']).optional(),
      })
      .default({}),
  })
  .refine((data) => data.mediaIds || data.projectId, {
    message: 'Must provide either an array of mediaIds or a projectId',
  })

export default defineEventHandler(async (event) => {
  try {
    const { orgId, projectId, mediaIds, params } = await readValidatedBody(event, (data) => downloadSchema.parse(data))

    const mediaStorage = useStorage<Resource<'media'>>(`data:resource:media`)
    const mediaKeys = await mediaStorage.getKeys()
    const allMedia = (await mediaStorage.getItems(mediaKeys)).flatMap(({ value }) => value?.record || [])

    const orgKey = notionNormalizeId(orgId)
    const projectKey = notionNormalizeId(projectId)

    let targetMedia: NotionMedia[] = []

    if (mediaIds && mediaIds.length > 0) {
      const mediaKeys = new Set(mediaIds.map((id) => notionNormalizeId(id)))
      targetMedia = allMedia.filter(({ id }) => mediaKeys.has(notionNormalizeId(id)))
    } else if (projectId) {
      targetMedia = allMedia.filter(({ properties }) => {
        const matchesProject = properties.Project?.relation?.some((r) => notionNormalizeId(r.id) === projectKey)
        const matchesStatus = params.status ? properties.Status.status.name.toLowerCase() === params.status.toLowerCase() : true

        return matchesProject && matchesStatus
      })
    }

    if (targetMedia.length === 0) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'No media found matching criteria' })
    }

    const expiresInSeconds = 3600

    const assets = await Promise.all(
      targetMedia.map(async ({ id: mediaId, properties }) => {
        const filename = notionTextStringify(properties.Name?.title)
        const slug = properties.Slug.formula.string
        // FIXME: get the mime type to extension
        const objectKey = `processed/${orgKey}/${projectKey}/${slug}.jpg`

        const downloadUrl = await r2GetPresignedDownloadUrl(r2Drive, `${process.env.NITRO_PRIVATE_DRIVE_R2_ENDPOINT}/${process.env.NITRO_PRIVATE_DRIVE_R2_BUCKET}`, objectKey, expiresInSeconds)

        return {
          mediaId,
          filename,
          downloadUrl,
        }
      })
    )

    return {
      updatedCount: assets.length,
      expiresIn: expiresInSeconds,
      assets,
    }
  } catch (error: any) {
    console.error('API /media/downloads POST Error:', error)

    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
