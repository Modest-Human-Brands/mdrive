import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { StreamStatus } from 'src/api/stream/[id].step'

export default async function (slug: string, deviceId: string): Promise<StreamStatus> {
  const deviceDir = join(process.cwd(), 'static', 'stream', slug, deviceId)
  const masterPlaylist = join(deviceDir, 'hls', 'master.m3u8')
  try {
    await access(masterPlaylist)
    return StreamStatus.Live
  } catch {
    try {
      await access(deviceDir)
      return StreamStatus.Starting
    } catch {
      return StreamStatus.Idle
    }
  }
}
