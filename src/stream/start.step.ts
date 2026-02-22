import type { Handlers, StepConfig } from 'motia'
import { z } from 'zod'

export const RTMP_BASE_URL = 'rtmp://localhost:1935'

export const config = {
  name: 'StreamStart',
  description: 'Start an HLS stream from RTMP input',
  flows: ['live-stream'],
  triggers: [
    {
      type: 'http',
      method: 'POST',
      path: '/stream/start',
      bodySchema: z.object({ streamKey: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({ streamKey: z.string(), rtmpUrl: z.string(), hlsUrl: z.string() }),
        400: z.object({ error: z.string() }),
      },
    },
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
      rtmpUrl: `${RTMP_BASE_URL}/live/${streamKey}/${deviceId}`,
      hlsUrl: `/stream/${streamKey}/${deviceId}/index.m3u8`,
    },
  }
}
