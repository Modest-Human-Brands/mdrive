import { defineEventHandler, readValidatedBody, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { randomUUID } from 'uncrypto'
import { z } from 'zod'

const commentSchema = z.object({
  mediaIds: z.array(z.string()).min(1, 'Must provide at least one media ID'),
  parentId: z.string().nullable().optional(),
  text: z.string().min(1, 'Comment text cannot be empty'),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullable()
    .optional(),
  author: z.object({
    name: z.string(),
    role: z.string(),
  }),
})

export default defineEventHandler(async (event) => {
  try {
    const { mediaIds, parentId, text, coordinates, author } = await readValidatedBody(event, commentSchema)

    const commentStorage = useStorage('data:comment')
    const createdComments = []

    const now = new Date().toDateString()

    for (const mediaId of mediaIds) {
      const commentId = `cmt_${randomUUID().slice(0, 8)}`

      const commentRecord = {
        commentId,
        mediaId,
        parentId: parentId || null,
        text,
        coordinates: parentId ? null : coordinates || null,
        author,
        createdAt: now,
      }

      await commentStorage.setItem(commentId, commentRecord)
      createdComments.push(commentRecord)
    }

    return {
      comments: createdComments,
    }
  } catch (error: any) {
    console.error('API /media/comments POST Error:', error)
    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
