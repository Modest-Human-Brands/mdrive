import { timingSafeEqual } from 'node:crypto'
import { defineEventHandler, HTTPError } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'

const PROTECTED_PREFIXES = ['/api/', '/webhook/']
const PUBLIC_PATHS = new Set(['/api/health'])

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export default defineEventHandler((event) => {
  const { pathname } = event.url

  if (event.req.method === 'OPTIONS' || PUBLIC_PATHS.has(pathname) || !PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return
  }

  const serverKey = useRuntimeConfig().private.serverValidationKey

  if (!serverKey) {
    throw new HTTPError({ statusCode: 500, statusMessage: 'API key is not configured' })
  }

  const clientKey = event.req.headers.get('x-api-key')

  if (!clientKey) {
    throw new HTTPError({ statusCode: 401, statusMessage: 'Missing x-api-key header' })
  }

  if (!safeEqual(clientKey, serverKey)) {
    throw new HTTPError({ statusCode: 403, statusMessage: 'Invalid API key' })
  }
})
