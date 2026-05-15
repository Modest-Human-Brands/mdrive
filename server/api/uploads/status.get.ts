import { defineEventHandler, getQuery, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const batchId = query.batchId as string

  if (!batchId) {
    throw new HTTPError({
      statusCode: 400,
      statusMessage: "'Missing batchId parameter'",
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
})
