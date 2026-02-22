import type { Handlers, StepConfig } from 'motia'
import { z } from 'zod'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export const config = {
  name: 'StreamStatus',
  description: 'List all active HLS streams',
  flows: ['live-stream'],
  triggers: [
    {
      type: 'http',
      method: 'GET',
      path: '/stream/status',
      responseSchema: {
        200: z.object({
          streams: z.array(z.object({ streamKey: z.string(), hlsUrl: z.string(), rtmpUrl: z.string() })),
        }),
      },
    },
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const hlsRoot = join(process.cwd(), 'static', 'stream')

  try {
    const keys = await readdir(hlsRoot)
    logger.info(`Active streams: ${keys.join(', ')}`)
    return {
      status: 200,
      body: {
        streams: keys.map((streamKey) => ({
          streamKey,
          hlsUrl: `/hls/${streamKey}/index.m3u8`,
          rtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
        })),
      },
    }
  } catch {
    return { status: 200, body: { streams: [] } }
  }
}
