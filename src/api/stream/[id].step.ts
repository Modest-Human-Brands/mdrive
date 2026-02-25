import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

const streamSchema = z.object({
  slug: z.string(),
  deviceId: z.string(),
  srtUrl: z.string(),
  hlsUrl: z.string(),
  isLive: z.boolean(),
})

export const config = {
  name: 'StreamStatus',
  description: 'Get a single active HLS stream by slug (slug-deviceId)',
  flows: ['live-stream-flow'],
  triggers: [
    http('GET', '/stream/:slug/:deviceId', {
      responseSchema: {
        200: streamSchema,
        404: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ pathParams }, { logger }) => {
  const { slug, deviceId } = pathParams

  if (!slug || !deviceId) {
    return { status: 404, body: { error: 'Invalid slug format, expected slug-deviceId' } }
  }

  const hlsPath = join(process.cwd(), 'static', 'stream', slug, deviceId, 'hls', 'master.m3u8')

  try {
    await access(hlsPath)
  } catch {
    logger.warn(`Stream not found: ${slug}`)
    return { status: 404, body: { error: `Stream ${slug} not found` } }
  }

  logger.info(`Stream found: ${slug}`)

  return {
    status: 200,
    body: {
      slug,
      deviceId,
      srtUrl: `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}?streamid=live/${slug}/${deviceId}`,
      hlsUrl: `stream/${slug}/${deviceId}/hls/master.m3u8`,
      isLive: true,
    },
  }
}
