import { defineEventHandler, readValidatedBody, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'

const querySchema = z.object({
  mediaIds: z.array(z.string()).min(1, 'Must provide at least one media ID'),
})

export default defineEventHandler(async (event) => {
  try {
    const { mediaIds } = await readValidatedBody(event, querySchema)

    const commentStorage = useStorage('data:comment')
    const commentKeys = await commentStorage.getKeys()

    const allComments = (await Promise.all(commentKeys.map((key) => commentStorage.getItem(key)))).filter(Boolean) as any[]

    const timelines: Record<string, any[]> = {}
    for (const id of mediaIds) {
      timelines[id] = []
    }

    const targetedComments = allComments.filter((c) => mediaIds.includes(c.mediaId))

    targetedComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const rootMap: Record<string, any> = {}

    for (const comment of targetedComments) {
      if (!comment.parentId) {
        rootMap[comment.commentId] = { ...comment, replies: [] }
      }
    }

    for (const comment of targetedComments) {
      if (comment.parentId && rootMap[comment.parentId]) {
        const { mediaId, ...cleanReply } = comment
        rootMap[comment.parentId].replies.push(cleanReply)
      }
    }

    for (const rootComment of Object.values(rootMap)) {
      if (timelines[rootComment.mediaId]) {
        const { mediaId, ...cleanRoot } = rootComment
        timelines[mediaId].push(cleanRoot)
      }
    }

    return {
      timelines,
    }
  } catch (error: any) {
    console.error('API /media/comments/query POST Error:', error)
    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
