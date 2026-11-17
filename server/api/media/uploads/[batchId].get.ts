import { defineEventHandler, getValidatedRouterParams, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import { assertProjectAccess } from '~/server/utils/org-access'

const pathParamsSchema = z.object({ batchId: z.string() })

export default defineEventHandler(async (event) => {
  try {
    const { batchId } = await getValidatedRouterParams(event, pathParamsSchema)

    if (!batchId) {
      throw new HTTPError({
        statusCode: 400,
        statusMessage: 'Missing batchId parameter',
      })
    }

    const uploadMetaStorage = useStorage('data:upload')
    const batchData = await uploadMetaStorage.getItem(batchId)

    if (!batchData) {
      throw new HTTPError({
        statusCode: 404,
        statusMessage: 'Upload batch not found',
      })
    }

    await assertProjectAccess(event, (batchData as { projectId: string }).projectId)

    return batchData
  } catch (error: any) {
    console.error('API /media/uploads/[batchId] GET Error:', error)

    throw new HTTPError({
      statusCode: error.status || error.statusCode || 500,
      statusMessage: error.statusMessage || 'Some Unknown Error Found',
    })
  }
})
