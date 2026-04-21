import { useStorage } from 'nitro/storage'
import path from 'node:path'

export async function generateMpd(params: { mediaId: string }): Promise<string> {
  const fs = useStorage('fs')

  const { mediaId } = params
  const mpdXml = await fs.getItemRaw(path.join('cache/video', `${mediaId}.mpd`))

  return mpdXml
}
