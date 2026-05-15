import { defineEventHandler, readValidatedBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(
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
  const { batchId, uploadId, status, progressPercent, mediaId, error, data } = body

  const uploadMetaStorage = useStorage('data:upload')
  const mediaStorage = useStorage('data:media')

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

  batchData.uploads = batchData.uploads.map((upload) => {
    if (upload.uploadId === uploadId) {
      return {
        ...upload,
        status,
        progressPercent,
        mediaId,
        error,
      }
    }
    return upload
  })

  await uploadMetaStorage.setItem(batchId, batchData)

  if (data?.metadata) {
    await mediaStorage.setItem(uploadId, data.metadata)
  }

  return { success: true }
})
