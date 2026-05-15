import { defineEventHandler, getValidatedRouterParams, H3Event, type EventHandlerRequest } from 'nitro/h3'
import { defineCachedFunction } from 'nitro/cache'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { ofetch } from 'ofetch'

import z from 'zod'
import { consola } from 'consola'
import * as mime from 'mime-types'
import { hash } from 'ohash'

import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'

import { CODEC_MAP } from '~/server/types'

import diskPutFileStream from '~/server/utils/disk-put-file-stream'
import parseIpxArgs from '~/server/utils/parse-ipx-args'
import r2Drive from '~/server/utils/r2-drive'
import r2GetAllFiles from '~/server/utils/r2-get-all-files'
import r2GetFileStream from '~/server/utils/r2-get-file-stream'
import { generateMpd } from '~/server/utils/generate-mpd'
import r2Cdn from '~/server/utils/r2-cdn'

function normalizeArgs(rawArgs: string) {
  const decodedArgs = decodeURIComponent(rawArgs || '')
    .replace(/%2C/gi, ',')
    .replace(/&/g, ',')
    .replace(/\s+/g, '')
  const tokens = decodedArgs
    .split(',')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  const normArgs = tokens.join(',')

  return normArgs
}

function disabledMimeType(mime: string, accept: string) {
  return accept
    .split(',')
    .map((p) => p.trim())
    .some((p) => p.startsWith(mime) && /;q=0(\.0+)?\b/.test(p))
}

function supportsMimeType(mime: string, accept: string) {
  if (!accept) return false
  if (disabledMimeType(mime, accept)) return false
  return accept.includes(mime)
}

function negotiateImageFormat(event: H3Event<EventHandlerRequest>): { format: 'avif' | 'webp' | 'jpeg' } {
  let format: 'avif' | 'webp' | 'jpeg' = 'jpeg'

  const acceptHeader = event.req.headers.get('accept') || ''
  const accept = (acceptHeader || '').toLowerCase()

  if (supportsMimeType('image/avif', accept)) format = 'avif'
  else if (supportsMimeType('image/webp', accept)) format = 'webp'

  return { format }
}

function negotiateVideoFormat(event: H3Event<EventHandlerRequest>): {
  format: string
  codec: string
} {
  const accept = (event.req.headers.get('accept') || '').toLowerCase()
  let format: 'mp4' | 'webm' | 'ogg' = 'mp4'

  // 1. Determine the container format
  if (supportsMimeType('video/av1', accept) || supportsMimeType('video/webm', accept)) {
    format = 'webm'
  } else if (supportsMimeType('video/ogg', accept)) {
    format = 'ogg'
  }

  // 2. Extract and identify the codec from the header
  const codecMatch = accept.match(/codecs="([^"]+)"/i)?.[1]?.toLowerCase() || ''
  let codec: string | null = null

  if (codecMatch.includes('av1')) {
    codec = 'av1'
  } else if (codecMatch.includes('vp9')) {
    codec = 'vp9'
  } else if (codecMatch.includes('hevc') || codecMatch.includes('hvc1')) {
    codec = 'hevc'
  } else if (codecMatch.includes('avc') || codecMatch.includes('h264')) {
    codec = 'avc'
  }

  // 3. Fallback logic based on format
  if (!codec) {
    if (format === 'webm') {
      codec = 'vp9'
    } else if (format === 'ogg') {
      codec = 'theora'
    } else {
      codec = 'avc'
    }
  }

  return {
    format,
    codec,
  }
}

/* function getChunkRange(event: H3Event<EventHandlerRequest>, bufferSize: number): { chunkStart: number; chunkEnd: number; chunkSize: number } {
  const range = event.req.headers.get('range')
  let chunkStart = 0
  let chunkEnd = bufferSize - 1
  let chunkSize = bufferSize

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    chunkStart = parseInt(parts[0], 10)
    chunkEnd = parts[1] ? parseInt(parts[1], 10) : bufferSize - 1
    chunkSize = chunkEnd - chunkStart + 1
  }

  return { chunkStart, chunkEnd, chunkSize }
}*/

function buildCacheKey({ kind, source, args, ext }: { kind: string; source: string; args: string; ext: string }) {
  const keyHash = hash({ kind, source, args })
  return `cache/${kind}/${keyHash}.${ext}`
}

export const syncDrive = defineCachedFunction(
  async () => {
    consola.log('🔄 Syncing Drive')
    const config = useRuntimeConfig()

    const nameToPathMap: { [key: string]: string } = {}
    const allItemKeys = await r2GetAllFiles(r2Drive, {
      endpoint: config.private.driveR2Endpoint,
      bucket: config.private.driveR2Bucket,
    })

    for (const path of allItemKeys) {
      const [_, ...b] = path.split('_')
      if (b.at(-1) === 'thumb') continue

      const key = b.join('_').split('.').slice(0, -1).join('.')
      nameToPathMap[key] = path
    }

    return nameToPathMap
  },
  { swr: true, staleMaxAge: 60 * 7, maxAge: 60 * 10 }
)

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const { kind, rest } = await getValidatedRouterParams(event, z.object({ kind: z.enum(['image', 'audio', 'video']), rest: z.string().min(1) }).parse)
    const [rawArgs, rawMediaId] = rest.split('/')
    const mediaId = rawMediaId!.replace(/\.[^.]+$/, '')

    if (!mediaId) new Error(JSON.stringify({ statusCode: 400, message: 'Missing media mediaId' }))

    const args = normalizeArgs(rawArgs!)

    const r2 = useStorage('cdnR2')
    const fs = useStorage('fs')

    // event.res.headers.set('x-robots-tag', 'noindex, nofollow, noarchive, nosnippet')
    event.res.headers.set('cache-control', 'public, max-age=31536000, immutable')

    // Pipeline of image
    if (kind === 'image') {
      const modifiers = parseIpxArgs(args)

      const { format } = negotiateImageFormat(event)
      modifiers.format = !modifiers.format || modifiers.format === 'auto' ? format : modifiers.format
      // consola.log('⚙️ Image Modifiers', modifiers)

      const contentType = mime.types[`${modifiers.format}`] ?? 'application/octet-stream'
      event.res.headers.set('vary', 'accept')
      event.res.headers.set('content-type', contentType)

      const cacheKey = buildCacheKey({ kind, source: mediaId, args: JSON.stringify(modifiers), ext: modifiers.format as string })
      const cachePath = `./static/${cacheKey}`

      // FS cache
      if (await fs.hasItem(cacheKey)) {
        const metaData = await fs.getMeta(cacheKey)
        const data = {
          stream: createReadStream(cachePath),
          contentType,
          byteLength: metaData.size,
        }

        if (event.req.method === 'HEAD') {
          return
        }

        consola.success('✅ Image FS Cache HIT', { cacheKey, bytes: data.byteLength })
        return data.stream
      }

      // R2 cache
      if (await r2.hasItem(cacheKey)) {
        const data = await r2GetFileStream(r2Cdn, cacheKey)
        const [toDisk, toClient] = data.stream.tee()

        diskPutFileStream(cachePath, toDisk).then(() => {
          consola.info('💾 Image Saved to FS cache', { cacheKey, bytes: data.byteLength })
        })

        if (event.req.method === 'HEAD') {
          return
        }

        consola.success('✅ Image R2 Cache HIT', { cacheKey, bytes: data.byteLength })
        return toClient
      }

      const mediaOriginId = (await syncDrive())[mediaId]
      if (!mediaOriginId) {
        new Error(JSON.stringify({ statusCode: 404, message: '🚧 Missing media' }))
      }

      consola.warn('⚠️ Image Cache MISS', { cacheKey })

      // const { result: data } = await executeTask<{
      //   streamPath: string
      //   contentType: string
      //   byteLength: number
      // }>('transform:image', { payload: { cacheKey, mediaOriginId, modifiers } })

      const data = await ofetch<{
        streamPath: string
        contentType: string
        byteLength: number
      }>('/media', {
        baseURL: config.private.mediaUrl,
        method: 'POST',
        body: {
          taskType: 'transform:image',
          payload: { cacheKey, mediaOriginId, modifiers },
        },
      })

      if (!data?.streamPath) {
        throw new Error(JSON.stringify({ statusCode: 500, statusMessage: 'No stream generated' }))
      }

      const stream = Readable.toWeb(createReadStream(data.streamPath))
      const [_storageStream, responseStream] = stream.tee()

      // Cache to Storage (fire-and-forget; errors are logged)
      /*  r2PutFileStream(r2Cdn, cacheKey, storageStream as ReadableStream, data.byteLength)
         .then(() => {
           consola.info('💾 Image Saved to R2 cache', { cacheKey, bytes: data.byteLength })
         })
         .catch((error) => {
           consola.error('Failed to save to cache', error)
         }) */

      return responseStream
    } // Pipeline of audio
    else if (kind === 'audio') {
      // const cacheKey = buildCacheKey({ kind, source: mediaId, args:JSON.stringify(modifiers), ext: 'mp3' })
      // const cachePath = `./static/${cacheKey}`
    } // Pipeline of video
    /* else {
      const modifiers = parseIpxArgs(args)

      const { format, codec } = negotiateVideoFormat(event)
      modifiers.format = !modifiers.format || modifiers.format === 'auto' ? format : modifiers.format
      modifiers.codec = !modifiers.codec || modifiers.codec === 'auto' ? codec : modifiers.codec
      // consola.log('⚙️ Video Modifiers', modifiers)

      const rangeHeader = event.req.headers.get('range')
      const mimeType = `video/${modifiers.format}`

      const codecDetail = modifiers?.codec ? CODEC_MAP[modifiers.codec as 'av1' | 'hevc' | 'vp9' | 'avc'] : ''
      const contentType = `${mimeType}; codecs="${codecDetail}"`
      setResponseHeaders(event, {
        'accept-ranges': 'bytes',
        'content-type': contentType,
      })

      const cacheKey = buildCacheKey({ kind, source: mediaId, args, ext: modifiers.format as string })
      const cachePath = `./static/${cacheKey}`

      // FS cache
      if (await fs.hasItem(cacheKey)) {
        const metaData = await fs.getMeta(cacheKey)
        const byteLength = metaData.size as number

        const data: {
          stream?: ReadStream
          contentType?: string
          byteLength?: number
        } = {}

        if (!rangeHeader) {
          setResponseHeaders(event, {
            'content-length': byteLength,
          })

          if (event.method === 'HEAD') {
            return
          }
          data.stream = createReadStream(cachePath)
          data.contentType = contentType
          data.byteLength = byteLength
        } else {
          const { chunkStart: start, chunkEnd: end } = getChunkRange(event, byteLength)
          const length = end - start + 1

          setResponseStatus(event, 206)

          setResponseHeaders(event, {
            'content-length': length,
            'content-range': `bytes ${start}-${end}/${byteLength}`,
          })

          if (event.method === 'HEAD') {
            return
          }
          data.stream = createReadStream(cachePath, { start, end })
          data.contentType = contentType
          data.byteLength = length
        }

        consola.success('✅ Video FS Cache HIT', { cacheKey, bytes: data.byteLength })
        return data.stream
      }

      // R2 cache
      if (await r2.hasItem(cacheKey)) {
        const { stream, byteLength } = await r2GetFileStream(r2Cdn, cacheKey)
        const [diskStream, clientStream] = stream.tee()

        const rangeHeader = event.req.headers.get('range')

        const data: {
          stream?: ReadableStream
          contentType?: string
          byteLength?: number
        } = {}

        if (!rangeHeader) {
          setResponseHeaders(event, {
            'content-length': byteLength,
          })

          data.stream = clientStream
          data.contentType = contentType
          data.byteLength = byteLength
        } else {
          const { chunkStart: start, chunkEnd: end } = getChunkRange(event, byteLength)
          const length = end - start + 1

          setResponseStatus(event, 206)

          setResponseHeaders(event, {
            'content-length': length,
            'content-range': `bytes ${start}-${end}/${byteLength}`,
          })

          data.stream = clientStream.pipeThrough(streamRangeSlice(start, end))
          data.contentType = contentType
          data.byteLength = length
        }

        // Save to FS cache in background
        diskPutFileStream(cachePath, diskStream).then(() => {
          consola.info('💾 Video Saved to FS cache', { cacheKey, bytes: data.byteLength })
        })

        consola.success('✅ Video R2 Cache HIT', { cacheKey, bytes: data.byteLength })
        return data.stream as ReadableStream
      }

      const mediaOriginId = (await syncDrive())[mediaId]
      if (!mediaOriginId) {
        throw createError({ statusCode: 404, message: '🚧 Missing media' })
      }

      consola.warn('⚠️ Video Cache MISS', { cacheKey })

      if (event.method === 'HEAD') {
        return
      }

      const { result: data } = await executeTask<{
        streamPath: string
        contentType: string
        byteLength: number
      }>('transform:video', { payload: { cacheKey, mediaOriginId, modifiers } })

      if (!data?.streamPath) {
        throw createError({ statusCode: 500, statusMessage: 'No stream generated' })
      }

      const stream = Readable.toWeb(createReadStream(data.streamPath))
      const [storageStream, responseStream] = stream.tee()

      // Cache to Storage (fire-and-forget; errors are logged)
      r2PutFileStream(r2Cdn,cacheKey, storageStream as ReadableStream, data.byteLength)
        .then(() => {
          consola.info('💾 Video Saved to R2 cache', { cacheKey, bytes: data.byteLength })
        })
        .catch((error) => {
          consola.error('Failed to save to cache', error)
        })

      return responseStream
    } */
    else {
      const cacheKey = `cache/${kind}/${rawMediaId}` //buildCacheKey({ kind, source: mediaId, args: JSON.stringify(modifiers), ext: modifiers.format as string })
      const modifiers = parseIpxArgs(args)

      const { format, codec } = negotiateVideoFormat(event)
      modifiers.format = !modifiers.format || modifiers.format === 'auto' ? format : modifiers.format
      modifiers.codec =
        !modifiers.codec || modifiers.codec === 'auto'
          ? codec
          : modifiers.codec
              .split('-')
              .map((c) => CODEC_MAP[c]!.short)
              .join('-')
      modifiers.quality = !modifiers.quality || !modifiers.quality ? `80` : modifiers.quality

      if (event.url.pathname.endsWith('.mpd')) {
        console.log('Manifest File')

        event.res.headers.set('content-type', 'text/plain')

        // const [minRes = 360, maxRes = 1920] = modifiers.resize.split('-').map((item) => parseInt(item) || undefined)

        const mpd = await generateMpd({
          mediaId,
        })

        if (!mpd) {
          const mediaOriginId = (await syncDrive())[mediaId.split('_')[0]!]
          if (!mediaOriginId) {
            throw new Error(JSON.stringify({ statusCode: 404, message: '🚧 Missing media' }))
          }

          consola.warn('⚠️ Video Cache MISS', { cacheKey })

          const data = await ofetch<{
            streamPath: string
            contentType: string
            byteLength: number
          }>('/media', {
            baseURL: config.private.mediaUrl,
            method: 'POST',
            body: {
              taskType: 'transform:video',
              payload: { cacheKey, mediaId: mediaId.split('_')[0], mediaOriginId, modifiers },
            },
          })

          if (!data?.streamPath) {
            throw new Error(JSON.stringify({ statusCode: 500, statusMessage: 'No stream generated' }))
          }
        }

        return mpd
      } else {
        const cacheKey = `cache/${kind}/${rawMediaId}` //buildCacheKey({ kind, source: mediaId, args: JSON.stringify(modifiers), ext: modifiers.format as string })
        const cachePath = `./static/${cacheKey}`

        const contentType = mime.types[`${modifiers.format}`] ?? 'application/octet-stream'

        event.res.headers.set('vary', 'accept')
        event.res.headers.set('content-type', contentType)

        // FS cache
        if (await fs.hasItem(cacheKey)) {
          const metaData = await fs.getMeta(cacheKey)
          const data = {
            stream: createReadStream(cachePath),
            contentType,
            byteLength: metaData.size,
          }

          if (event.req.method === 'HEAD') {
            return
          }

          consola.success('✅ Video FS Cache HIT', { cacheKey, bytes: data.byteLength })
          return data.stream
        }

        // R2 cache
        if (await r2.hasItem(cacheKey)) {
          const data = await r2GetFileStream(r2Cdn, cacheKey)
          const [toDisk, toClient] = data.stream.tee()

          diskPutFileStream(cachePath, toDisk).then(() => {
            consola.info('💾 Video Saved to FS cache', { cacheKey, bytes: data.byteLength })
          })

          if (event.req.method === 'HEAD') {
            return
          }

          consola.success('✅ Video R2 Cache HIT', { cacheKey, bytes: data.byteLength })
          return toClient
        }

        throw new Error(JSON.stringify({ statusCode: 400, message: 'Missing media mediaId' }))

        /*  const stream = Readable.toWeb(createReadStream(data.streamPath))
         const [storageStream, responseStream] = stream.tee()
 
         // Cache to Storage (fire-and-forget; errors are logged)
         r2PutFileStream(r2Cdn, cacheKey, storageStream as ReadableStream, data.byteLength)
           .then(() => {
             consola.info('💾 Video Saved to R2 cache', { cacheKey, bytes: data.byteLength })
           })
           .catch((error) => {
             consola.error('Failed to save to cache', error)
           })
 
         return responseStream */
      }
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    consola.error('Route media GET', error)
    throw new Error(JSON.stringify({ statusCode: 500, message: 'Some Unknown Error Found' }))
  }
})
