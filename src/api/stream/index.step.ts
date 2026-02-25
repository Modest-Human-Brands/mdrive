import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export const config = {
  name: 'StreamStatus',
  description: 'List all active HLS streams',
  flows: ['live-stream-flow'],
  triggers: [
    http('GET', '/stream', {
      responseSchema: {
        200: z.object({
          streams: z.array(
            z.object({
              slug: z.string(),
              deviceId: z.string(),
              hlsUrl: z.string(),
              streamUrl: z.string(),
              isLive: z.boolean(),
            })
          ),
        }),
      },
      middleware: [],
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const hlsRoot = join(process.cwd(), 'static', 'stream')

  try {
    const slugs = await readdir(hlsRoot)
    const streams = (
      await Promise.all(
        slugs.map(async (slug) => {
          const deviceIds = await readdir(join(hlsRoot, slug))
          return deviceIds.map((deviceId) => ({
            slug,
            deviceId,
            isLive: true,
            poster: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80',
            client: { name: 'True Mens', avatar: 'https://placehold.co/40x40/1a1a1a/ffd700?text=TM' },
            streamUrl: `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}/live/${slug}/${deviceId}`,
            media: `stream/${slug}/${deviceId}/hls/master.m3u8`,
          }))
        })
      )
    ).flat()

    logger.info(`Active streams: ${streams.map((s) => `${s.slug}:${s.deviceId}`).join(', ')}`)

    return {
      status: 200,
      body: streams,
    }
  } catch {
    return { status: 200, body: { streams: [] } }
  }
}
