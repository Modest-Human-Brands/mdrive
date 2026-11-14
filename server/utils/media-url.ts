import { useRuntimeConfig } from 'nitro/runtime-config'

/**
 * Public URL of a transformed image. Uses the configured origin when set (MDrive or the
 * CDN in front of it), otherwise a relative path the web app's `/media` proxy resolves.
 */
export default function mediaUrl(slug: string, args = 's_810x1080') {
  const origin = useRuntimeConfig().public.mediaUrl.replace(/\/$/, '')
  return `${origin}/media/image/${args}/${slug}`
}
