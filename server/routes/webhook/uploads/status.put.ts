import { defineEventHandler, readValidatedBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import notion from '~/server/utils/notion'

export default defineEventHandler(async (event) => {
  try {
    const { batchId, projectId, uploadId, filename, status, progressPercent, mediaId, error, data } = await readValidatedBody(
      event,
      z.object({
        batchId: z.string(),
        projectId: z.string(),
        uploadId: z.string(),
        filename: z.string(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
        progressPercent: z.number(),
        mediaId: z.string().nullable(),
        error: z.string().nullable(),
        data: z
          .object({
            metadata: z.any().optional(),
          })
          .nullable()
          .optional(),
      })
    )
    const uploadMetaStorage = useStorage('data:upload')

    const batchData = await uploadMetaStorage.getItem<{
      projectId: string
      uploads: {
        uploadId: string
        filename: string
        status: string
        progressPercent: number
        mediaId: string | null
        error: string | null
      }[]
    }>(batchId)

    if (!batchData || !Array.isArray(batchData.uploads)) {
      return { success: false, error: 'Batch meta-record not found' }
    }

    let finalMediaId = mediaId

    if (data?.metadata) {
      const notionProperties: any = {
        Name: { title: [{ text: { content: filename } }] },
        Project: { relation: [{ id: projectId }] }, // Assumes projectId is the Notion Page ID of the project
        Type: { select: { name: data.metadata.kind === 'video' ? 'Video' : 'Photo' } },
        Status: { select: { name: status === 'completed' ? 'Draft' : 'Plan' } },
      }

      if (finalMediaId) {
        await notion.pages.update({ page_id: finalMediaId, properties: notionProperties })
      } else {
        const newPage = await notion.pages.create({
          parent: { database_id: process.env.NOTION_MEDIA_DB_ID! },
          properties: notionProperties,
        })
        finalMediaId = newPage.id
      }
    }

    batchData.uploads = batchData.uploads.map((upload) => {
      if (upload.uploadId === uploadId) {
        return {
          ...upload,
          status,
          progressPercent,
          mediaId: finalMediaId,
          error,
        }
      }
      return upload
    })

    await uploadMetaStorage.setItem(batchId, batchData)

    return { success: true }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    console.error('Route webhook/uploads PUT', error)
    throw new Error(JSON.stringify({ statusCode: 500, message: 'Some Unknown Error Found' }))
  }
})
