import { defineEventHandler, getValidatedRouterParams, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'

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

    return batchData
  } catch (error: any) {
    console.error('API /media/uploads/[batchId] POST Error:', error)

    throw new HTTPError({
      statusCode: 500,
      statusMessage: 'Some Unknown Error Found',
    })
  }
})
