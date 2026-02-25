import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'StreamStart',
  description: 'Start an HLS stream from SRT input',
  flows: ['live-stream-flow'],
  triggers: [
    http('POST', '/stream/start', {
      bodySchema: z.object({ slug: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({ slug: z.string(), streamUrl: z.string(), hlsUrl: z.string() }),
        400: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [{ topic: 'stream.process', label: 'Process using FFmpeg' }],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ body }, { enqueue, logger }) => {
  const { slug, deviceId } = body

  if (!slug) return { status: 400, body: { error: 'slug required' } }

  logger.info(`Starting stream: ${slug} ${deviceId}`)

  await enqueue({
    topic: 'stream.process',
    data: {
      slug,
      deviceId,
    },
  })

  return {
    status: 200,
    body: {
      slug,
      deviceId,
      streamUrl: `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}/live/${slug}/${deviceId}`,
      hlsUrl: `stream/${slug}/${deviceId}/hls/master.m3u8`,
    },
  }
}
