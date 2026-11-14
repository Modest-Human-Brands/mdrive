import { HTTPError } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { $fetch } from 'ofetch'

export type TransformResult = {
  streamPath: string
  contentType: string
  byteLength: number
}

/** Calls MMedia `POST /media/transform` with the shared API key. */
export default async function mmediaTransform(body: { taskType: 'transform:image' | 'transform:video'; payload: Record<string, unknown> }) {
  const { mmediaUrl, mmediaApiKey } = useRuntimeConfig().private

  if (!mmediaUrl || !mmediaApiKey) {
    throw new HTTPError({ statusCode: 500, statusMessage: 'MMedia is not configured' })
  }

  try {
    return await $fetch<TransformResult>('/media/transform', {
      baseURL: mmediaUrl,
      method: 'POST',
      headers: { 'x-api-key': mmediaApiKey },
      body,
    })
  } catch (error: any) {
    const status = error?.response?.status ?? error?.statusCode
    const reason = status === 401 || status === 403 ? 'MMedia rejected the API key' : status ? `MMedia answered ${status}` : 'MMedia is unreachable'

    console.error('[mmedia-transform]', reason, error?.message)
    throw new HTTPError({ statusCode: 502, statusMessage: reason })
  }
}
