import { queue, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import getImageMetadata from 'src/utils/get-image-metadata'
import getVideoMetadata from 'src/utils/get-video-metadata'
import getResolution from 'src/utils/get-resolution'
import getAspectRatio from 'src/utils/get-aspect-ratio'
import calculateDimension from 'src/utils/calculate-dimension'

export const config = {
  name: 'MediaProcess',
  description: 'Extract metadata, resolution and aspect ratio for a saved media file',
  flows: ['upload-media'],
  triggers: [
    queue('media.file.saved', {
      input: z.object({
        slug: z.string(),
        relPath: z.string(),
        mimeType: z.string(),
        size: z.number(),
        projectSlug: z.string(),
        traceId: z.string(),
      }),
    }),
  ],
  enqueues: [{ topic: 'media.file.processed', label: 'Metadata extracted and ready for sync' }],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ slug, relPath, mimeType, size, projectSlug, traceId }, { enqueue, logger }) => {
  logger.info(`[${traceId}] Processing metadata`, { slug })

  const isImage = mimeType.startsWith('image/')
  const meta = isImage ? await getImageMetadata(relPath) : await getVideoMetadata(relPath)

  const originalWidth = !('stream' in meta) ? meta.format.width! : meta.stream.width!
  const originalHeight = !('stream' in meta) ? meta.format.height! : meta.stream.height!

  const resolutionLabel = getResolution(originalWidth, originalHeight)
  const aspectRatioLabel = getAspectRatio(originalWidth, originalHeight)
  const [aW, aH] = aspectRatioLabel.split(':').map(Number)
  const aspectRatio = aW / aH

  const { width: coverWidth, height: coverHeight } = calculateDimension(1080, aspectRatio)

  const duration = !isImage ? (meta as Awaited<ReturnType<typeof getVideoMetadata>>).format.duration : undefined

  logger.info(`[${traceId}] Metadata extracted`, { slug, resolutionLabel, aspectRatioLabel })

  await enqueue({
    topic: 'media.file.processed',
    data: {
      slug,
      relPath,
      mimeType,
      size,
      projectSlug,
      traceId,
      originalWidth,
      originalHeight,
      resolutionLabel,
      aspectRatioLabel,
      aspectRatio: `${aW}:${aH}`,
      coverWidth,
      coverHeight,
      duration,
    },
  })
}
