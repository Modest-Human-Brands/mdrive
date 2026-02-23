import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'HealthCheck',
  description: 'Return Health Status',
  flows: ['health-check-flow'],
  triggers: [
    http('GET', '/health', {
      responseSchema: {
        200: z.object({
          status: z.string(),
        }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_, { logger }) => {
  logger.info('Show Health Status')

  return {
    status: 200,
    body: { status: 'OK' },
  }
}
