import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { streamSchema } from './[id].step'
import resolveStreamStatus from 'src/utils/resolve-stream-status'

export const config = {
  name: 'StreamAllStatus',
  description: 'List all active HLS streams',
  flows: ['stream-flow'],
  triggers: [
    http('GET', '/stream', {
      responseSchema: {
        200: streamSchema,
      },
      middleware: [],
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  const hlsRoot = join(process.cwd(), 'static', 'stream')

  const slugs = await readdir(hlsRoot)
  const streams = (
    await Promise.all(
      slugs.map(async (slug) => {
        const deviceIds = await readdir(join(hlsRoot, slug))
        return Promise.all(
          deviceIds.map(async (deviceId) => ({
            slug: `${slug}-${deviceId}`,
            status: await resolveStreamStatus(slug, deviceId),
            streamUrl: `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}?streamid=live/${slug}/${deviceId}`,
            media: `stream/${slug}/${deviceId}/hls/master.m3u8`,
          }))
        )
      })
    )
  ).flat()

  logger.info(`Active streams: ${streams.map((s) => `${s.slug}:${s.deviceId} - ${s.status}`).join(', ')}`)

  return {
    status: 200,
    body: streams,
  }
}
