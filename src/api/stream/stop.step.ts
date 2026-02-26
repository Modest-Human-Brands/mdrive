import { http, type Handlers, type StepConfig } from 'motia'
import { deregisterProcess, getProcesses } from 'src/utils/stream-processes'
import { z } from 'zod'

export const config = {
  name: 'StreamStop',
  description: 'Stop a running HLS stream and clean up FFmpeg processes',
  flows: ['stream-flow'],
  triggers: [
    http('POST', '/stream/stop', {
      bodySchema: z.object({ slug: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({ stopped: z.boolean(), slug: z.string(), deviceId: z.string() }),
        400: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: ['stream.stopped'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ body }, { enqueue, logger, state }) => {
  const { slug, deviceId } = body

  if (!slug || !deviceId) return { status: 400, body: { error: 'slug and deviceId required' } }

  const killed: string[] = []

  for (const [key, proc] of getProcesses()) {
    if (key.startsWith(`${slug}:${deviceId}:`)) {
      proc.kill('SIGTERM')
      deregisterProcess(key, state)
      killed.push(key)
      logger.info(`Killed FFmpeg process: ${key}`)
    }
  }

  if (killed.length === 0) {
    return { status: 404, body: { error: `No running stream found for ${slug}:${deviceId}` } }
  }

  await enqueue({
    topic: 'stream.stopped',
    data: { slug, deviceId, killed },
  })

  return { status: 200, body: { stopped: true, slug, deviceId } }
}
