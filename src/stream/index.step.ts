import type { Handlers, StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'StreamUpload',
  description: 'Upload Stream to R2 Bucket',
  flows: ['upload-stream'],
  triggers: [
    {
      type: 'http',
      method: 'POST',
      path: '/stream',
      bodySchema: z.object({ path: z.string(), file: z.string() }),
      responseSchema: { 200: z.object({ status: z.string() }) },
    },
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ body }, { logger }) => {
  try {
    const { path, file } = body

    if (!path || !file) throw Error('Missing path or file')

    logger.info(`Uploading ${path}, ${file}`)

    return {
      status: 200,
      body: { status: 'uploaded' },
    }
  } catch (error) {
    console.error('API media/index GET', error)

    /*  throw createError({
       statusCode: 500,
       statusMessage: 'Some Unknown Error Found',
     }) */
  }
}
