import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { HTTPError } from 'nitro/h3'

import type { TransformResult } from '~/server/utils/mmedia-transform'
import r2Cdn from '~/server/utils/r2-cdn'
import r2GetFileStream from '~/server/utils/r2-get-file-stream'

/**
 * Opens the file MMedia produced. When MMedia shares a volume with MDrive the local
 * `streamPath` is readable and used; otherwise the file is read from the CDN bucket by `key`.
 * MDrive only ever reads here: MMedia is the one that writes.
 */
export default async function openTransformResult(result: Partial<TransformResult> | undefined): Promise<ReadableStream> {
  if (result?.streamPath) {
    const readable = await access(result.streamPath).then(
      () => true,
      () => false
    )
    if (readable) return Readable.toWeb(createReadStream(result.streamPath)) as ReadableStream
  }

  if (result?.key) {
    return (await r2GetFileStream(r2Cdn, result.key)).stream as ReadableStream
  }

  throw new HTTPError({ statusCode: 500, statusMessage: 'No stream generated' })
}
