import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { StreamStatus } from './[id].step'
import { DEFAULT_CODEC, DEFAULT_RENDITIONS } from 'src/job/stream/process.step'

export const config = {
  name: 'StreamStart',
  description: 'Start an HLS stream from SRT input',
  flows: ['stream-flow'],
  triggers: [
    http('POST', '/stream/start', {
      bodySchema: z.object({ slug: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({
          slug: z.string(),
          deviceId: z.string(),
          status: z.enum(StreamStatus),
          streamUrl: z.string(),
          media: z.string(),
        }),
        400: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: ['stream.process'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ body }, { enqueue, logger }) => {
  const { slug, deviceId } = body

  if (!slug) return { status: 400, body: { error: 'slug required' } }

  logger.info(`Starting stream: ${slug} ${deviceId}`)

  const deviceDir = join(process.cwd(), 'static', 'stream', slug, deviceId)

  // TODO: add a presistent global state instead of folder state
  await mkdir(join(deviceDir, 'original'), { recursive: true })
  for (const r of DEFAULT_RENDITIONS) {
    await mkdir(join(deviceDir, 'hls', `${r.name}-${DEFAULT_CODEC}`), { recursive: true })
  }

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
      status: StreamStatus.Starting,
      streamUrl: `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}?streamid=live/${slug}/${deviceId}`,
      media: `stream/${slug}/${deviceId}/hls/master.m3u8`,
    },
  }
}
