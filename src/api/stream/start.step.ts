import { http, type Handlers, type StepConfig } from 'motia'
import { corsMiddleware } from 'src/middleware/cors.middleware'
import { z } from 'zod'

export const config = {
  name: 'StreamStart',
  description: 'Start an HLS stream from RTMP input',
  flows: ['live-stream'],
  triggers: [
    http('POST', '/stream/start', {
      bodySchema: z.object({ streamKey: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({ streamKey: z.string(), rtmpUrl: z.string(), hlsUrl: z.string() }),
        400: z.object({ error: z.string() }),
      },
      middleware: [corsMiddleware],
    }),
  ],
  enqueues: [{ topic: 'stream.spawn', label: 'Spawn FFmpeg process' }],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ body }, { enqueue, logger }) => {
  const { streamKey, deviceId } = body

  if (!streamKey) return { status: 400, body: { error: 'streamKey required' } }

  logger.info(`Starting stream: ${streamKey} ${deviceId}`)

  await enqueue({
    topic: 'stream.spawn',
    data: {
      streamKey,
      deviceId,
    },
  })

  return {
    status: 200,
    body: {
      streamKey,
      deviceId,
      rtmpUrl: `${import.meta.env.MOTIA_RTMP_BASE_URL}/live/${streamKey}/${deviceId}`,
      hlsUrl: `stream/${streamKey}/${deviceId}/hls/master.m3u8`,
    },
  }
}
