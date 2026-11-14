import { defineEventHandler, getRouterParam, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

import type { Resource } from '~/server/types'
import mediaUrl from '~/server/utils/media-url'
import mediaMeta from '~/server/utils/media-meta'
import notionNormalizeId from '~/server/utils/notion-normalize-id'
import notionTextStringify from '~/server/utils/notion-text-stringify'

/** One media item with its file facts and EXIF block (null when unknown). */
export default defineEventHandler(async (event) => {
  try {
    const mediaId = notionNormalizeId(getRouterParam(event, 'mediaId')!.toString())

    const media = (await useStorage<Resource<'media'>>('data:resource:media').getItem(mediaId))?.record

    if (!media) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Media not found' })
    }

    const { properties } = media

    return {
      id: media.id,
      url: mediaUrl(properties.Slug.formula.string),
      filename: notionTextStringify(properties.Name.title),
      status: properties.Status?.status?.name?.toLowerCase() || 'pending',
      type: properties.Type?.select?.name?.toLowerCase() || 'photo',
      metadata: {
        resolution: properties.Resolution?.select?.name,
        aspectRatio: properties['Aspect ratio']?.select?.name,
      },
      ...mediaMeta(properties, media.created_time),
    }
  } catch (error: any) {
    console.error('API /media/[mediaId] GET Error:', error)
    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
