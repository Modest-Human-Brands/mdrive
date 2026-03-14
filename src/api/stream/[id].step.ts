import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'

import resolveStreamStatus from 'src/utils/resolve-stream-status'

export enum StreamStatus {
  Idle = 'idle', // registered, nothing started
  Starting = 'starting', // FFmpeg spawning, waiting for SRT connection
  Live = 'live', // SRT connected, actively encoding
  Paused = 'paused', // stream paused, FFmpeg still running
  Stopping = 'stopping', // SIGTERM sent, flushing buffers
  Stopped = 'stopped', // FFmpeg exited cleanly (code 0)
  Error = 'error', // FFmpeg exited with non-zero code
  Processing = 'processing', // post-stream: remux / R2 upload in progress
  Ready = 'ready', // processing done, VOD available
}

export const streamSchema = z.object({
  slug: z.string(),
  deviceId: z.string(),
  status: z.enum(StreamStatus),
  streamUrl: z.string(),
  media: z.string(),
})

export const config = {
  name: 'StreamStatus',
  description: 'Get a single active HLS stream by slug (slug-deviceId)',
  flows: ['stream-flow'],
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

  const status = await resolveStreamStatus(slug, deviceId)

  logger.info(`Stream found: ${slug}:${status}`)

  return {
    status: 200,
    body: {
      slug: `${slug}:${deviceId}`,
      status,
      streamUrl: `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}?streamid=live/${slug}/${deviceId}`,
      media: `stream/${slug}/${deviceId}/hls/master.m3u8`,
    },
  }
}
