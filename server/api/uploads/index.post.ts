import { defineEventHandler, readValidatedBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { randomUUID } from 'uncrypto'
import z from 'zod'
import r2Drive from '~/server/utils/r2-drive'

import r2GetPresignedUploadUrl from '~/server/utils/r2-get-presigned-upload-url'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({ orgId: z.string(), projectId: z.string(), files: z.array(z.object({ filename: z.string(), mimeType: z.string(), sizeBytes: z.number() })) }))
  const { orgId, projectId, files } = body

  const batchId = `batch_${randomUUID().slice(0, 8)}`
  const uploadMetaStorage = useStorage('data:upload')

  const uploadsResponse = []
  const initialStatusList = []

  for (const file of files) {
    const uploadId = `up_${randomUUID().slice(0, 8)}`
    const dotIdx = file.filename.lastIndexOf('.')
    const objectKey = `upload/${orgId}/${projectId}/${file.filename.slice(0, dotIdx)}-${batchId}-${uploadId}${dotIdx > 0 ? file.filename.slice(dotIdx) : ''}`

    const uploadUrl = await r2GetPresignedUploadUrl(r2Drive, `${process.env.NITRO_PRIVATE_DRIVE_R2_ENDPOINT}/${process.env.NITRO_PRIVATE_DRIVE_R2_BUCKET}`, objectKey, file.mimeType)

    uploadsResponse.push({
      filename: file.filename,
      uploadId,
      uploadUrl,
    })

    initialStatusList.push({
      uploadId,
      filename: file.filename,
      status: 'pending',
      progressPercent: 0,
      mediaId: null,
      error: null,
    })
  }

  await uploadMetaStorage.setItem(batchId, {
    projectId,
    uploads: initialStatusList,
  })

  return { batchId, uploads: uploadsResponse }
})
