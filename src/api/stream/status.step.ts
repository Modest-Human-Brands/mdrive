import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { corsMiddleware } from 'src/middleware/cors.middleware'

import { RTMP_BASE_URL } from './start.step'

export const config = {
  name: 'StreamStatus',
  description: 'List all active HLS streams',
  flows: ['live-stream'],
  triggers: [
    http('GET', '/stream/status', {
      responseSchema: {
        200: z.object({
          streams: z.array(
            z.object({
              slug: z.string(),
              streamKey: z.string(),
              deviceId: z.string(),
              hlsUrl: z.string(),
              rtmpUrl: z.string(),
              isLive: z.boolean(),
            })
          ),
        }),
      },
      middleware: [corsMiddleware],
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const hlsRoot = join(process.cwd(), 'static', 'stream')

  try {
    const streamKeys = await readdir(hlsRoot)
    const streams = (
      await Promise.all(
        streamKeys.map(async (streamKey) => {
          const deviceIds = await readdir(join(hlsRoot, streamKey))
          return deviceIds.map((deviceId) => ({
            slug: `${streamKey}-${deviceId}`,
            title: 'True Mens Product Photo Shoot Stream',
            rtmpUrl: `${RTMP_BASE_URL}/live/${streamKey}/${deviceId}`,
            media: `stream/${streamKey}/${deviceId}/hls/master.m3u8`,
            poster: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80',
            streamKey,
            deviceId,
            isLive: true,
            client: { name: 'True Mens', avatar: 'https://placehold.co/40x40/1a1a1a/ffd700?text=TM' },
          }))
        })
      )
    ).flat()

    logger.info(`Active streams: ${streams.map((s) => `${s.streamKey}:${s.deviceId}`).join(', ')}`)

    return {
      status: 200,
      body: streams,
    }
  } catch {
    return { status: 200, body: { streams: [] } }
  }
}
