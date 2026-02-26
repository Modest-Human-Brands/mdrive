import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import path from 'node:path'
import { Readable } from 'node:stream'
import Busboy from 'busboy'
import diskPutFileStream from 'src/utils/disk-put-file-stream'
import r2PutFileStream from 'src/utils/r2-put-file-stream'

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
}

function inferKind(mimeType: string): 'photo' | 'video' {
  return mimeType.startsWith('video/') ? 'video' : 'photo'
}

function isAllowedFile(filename: string, mimeType: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return !!ALLOWED_TYPES[mimeType]?.includes(ext)
}

function inferContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return Object.entries(ALLOWED_TYPES).find(([, exts]) => exts.includes(ext))?.[0] ?? 'application/octet-stream'
}

export const config = {
  name: 'MediaUpload',
  description: 'Ingest multipart media files, validate, generate slug, persist to disk and R2',
  flows: ['media-upload-flow'],
  triggers: [
    http('POST', '/media', {
      bodySchema: z.any(),
      querySchema: z.object({ slug: z.string() }),
    }),
  ],
  enqueues: ['media.file.saved', 'media.upload.failed'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { enqueue, logger, traceId }) => {
  const { projectSlug: slug } = req.queryParams
  const nodeReq = req

  const r2Endpoint = process.env.MOTIA_R2_ENDPOINT!
  const r2Bucket = process.env.MOTIA_R2_BUCKET!

  // Resolve project index from slug tail e.g. "brand-assets-49" => "0049"
  const projectIndexNum = parseInt((slug.match(/(\d+)\s*$/) ?? [])[1] ?? 'NaN', 10)
  if (isNaN(projectIndexNum)) {
    return { status: 400, body: { error: 'Invalid project slug format' } }
  }
  const projectIndex = String(projectIndexNum).padStart(4, '0')

  const failed: { filename: string; error: string }[] = []
  const fileWrites: Promise<void>[] = []
  let nextAssetIndex = 1 // caller should pass lastIndex+1 via body if needed

  const bb = Busboy({
    headers: nodeReq.headers,
    limits: { files: 200, fileSize: MAX_FILE_SIZE },
  })

  nodeReq.pipe(bb)

  await new Promise<void>((resolve, reject) => {
    bb.on('file', (fieldname, fileStream, info) => {
      if (fieldname !== 'files' && fieldname !== 'file') {
        fileStream.resume()
        return
      }

      const originalName = info?.filename ?? 'unknown'
      const mimeType = String(info?.mimeType ?? inferContentType(originalName))
      const ext = path.extname(originalName).toLowerCase()

      if (!isAllowedFile(originalName, mimeType)) {
        failed.push({ filename: originalName, error: `Invalid type: ${mimeType}` })
        fileStream.resume()
        return
      }

      const kind = inferKind(mimeType)
      const assetIndex = String(nextAssetIndex++).padStart(4, '0')
      const assetSlug = generateSemanticSlug(kind, projectIndex, assetIndex)
      const filename = `${assetSlug}${ext}`
      const relPath = path.join('source', filename)
      const absPath = path.join('static', relPath)

      const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>
      const [diskStream, r2Stream] = webStream.tee()

      const write = diskPutFileStream(absPath, diskStream)
        .then(async () => {
          logger.info(`[${traceId}] Disk saved`, { slug: assetSlug })

          // R2 needs size — get it from disk meta after write
          const { size } = await import('node:fs/promises').then((fs) => fs.stat(absPath))

          await r2PutFileStream(relPath, r2Stream, size, { endpoint: r2Endpoint, bucket: r2Bucket })
          logger.info(`[${traceId}] R2 saved`, { slug: assetSlug, size })

          await enqueue({
            topic: 'media.file.saved',
            data: { slug: assetSlug, relPath: absPath, mimeType, size, projectSlug: assetSlug, traceId },
          })
        })
        .catch(async (error) => {
          logger.error(`[${traceId}] Write failed`, { slug: assetSlug, error })
          failed.push({ filename: originalName, error: String(error) })
          await enqueue({ topic: 'media.upload.failed', data: { slug: assetSlug, error: String(error) } })
        })

      fileWrites.push(write)
    })

    bb.on('error', reject)
    bb.on('finish', async () => {
      try {
        await Promise.all(fileWrites)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })

  if (failed.length > 0 && fileWrites.length === 0) {
    return { status: 400, body: { success: false, errors: failed } }
  }

  if (failed.length > 0) {
    return { status: 207, body: { success: true, errors: failed } }
  }

  return { status: 200, body: { success: true } }
}
