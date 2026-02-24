import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import mime from 'mime-types'
import { createStorage } from 'unstorage'

import syncDrive from 'src/utils/sync-drive'

const fs = createStorage(/* opts */)

export const config = {
  name: 'MediaGet',
  description: 'Get a Media',
  flows: ['live-stream-flow'],
  triggers: [
    http('GET', '/media/[id]', {
      responseSchema: { 200: z.array(z.object({ slug: z.string(), type: z.string() })) },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_, { logger }) => {
  const { id } = await getValidatedRouterParams(
    event,
    z.object({
      id: z.string().min(1),
    }).parse
  )

  const mediaOriginId = (await syncDrive())[id]

  const mediaId = encodeURI(mediaOriginId).replaceAll('/', '_')
  const source = `./source/${mediaId}`
  // check if file already exists
  if (!(await fs.hasItem(source))) {
    const { stream } = await r2GetFileStream(encodeURI(mediaOriginId), 'origin', config.private.cloudreveR2Endpoint, config.private.cloudreveR2Bucket) // Web ReadableStream<Uint8Array>
    await stream.pipeTo(Writable.toWeb(createWriteStream(`./static/${source}`)))
  }

  const metaData = `${mime.lookup(mediaId)}`.includes('image') ? await getImageMetadata(`./static/${source}`) : await getVideoMetadata(`./static/${source}`)
  return metaData
}
