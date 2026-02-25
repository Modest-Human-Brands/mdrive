import { queue, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { execa } from 'execa'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deregisterProcess, hasProcess, registerProcess } from 'src/utils/stream-processes'

const renditionSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
  videoBitrate: z.string(),
  maxRate: z.string(),
  bufSize: z.string(),
  audioBitrate: z.string(),
})

const codecSchema = z.enum(['h264', 'h265', 'av1', 'vp9'])

export type Rendition = z.infer<typeof renditionSchema>
export type Codec = z.infer<typeof codecSchema>

const DEFAULT_RENDITIONS: Rendition[] = [
  { name: '1080p', width: 1920, height: 1080, videoBitrate: '5000k', maxRate: '5500k', bufSize: '10000k', audioBitrate: '128k' },
  { name: '720p', width: 1280, height: 720, videoBitrate: '2800k', maxRate: '3000k', bufSize: '6000k', audioBitrate: '128k' },
  { name: '480p', width: 854, height: 480, videoBitrate: '1500k', maxRate: '1800k', bufSize: '3000k', audioBitrate: '96k' },
  { name: '360p', width: 640, height: 360, videoBitrate: '800k', maxRate: '900k', bufSize: '1800k', audioBitrate: '96k' },
]

const DEFAULT_CODECS: Codec[] = ['h264']

const CODEC_CONFIG: Record<Codec, { encoder: string; ext: string; bandwidth: number; preset: string | null; tune: string | null }> = {
  h264: { encoder: 'libx264', ext: 'h264', bandwidth: 1, preset: 'veryfast', tune: 'zerolatency' },
  h265: { encoder: 'libx265', ext: 'h265', bandwidth: 0.6, preset: 'veryfast', tune: 'zerolatency' },
  av1: { encoder: 'libsvtav1', ext: 'av1', bandwidth: 0.5, preset: '10', tune: null },
  vp9: { encoder: 'libvpx-vp9', ext: 'vp9', bandwidth: 0.7, preset: null, tune: null },
}

const CODEC_STRINGS: Record<Codec, string> = {
  h264: 'avc1.42001e,mp4a.40.2',
  h265: 'hvc1.1.6.L93.90,mp4a.40.2',
  av1: 'av01.0.08M.08,mp4a.40.2',
  vp9: 'vp09.00.10.08,mp4a.40.2',
}

const CODEC_EXTRA_ARGS: Record<Codec, string[]> = {
  h264: [],
  h265: [],
  av1: [],
  vp9: ['-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1'],
}

const CODEC_HLS_FORMAT: Record<Codec, { segExt: string; hlsSegType: string }> = {
  h264: { segExt: 'ts', hlsSegType: 'mpegts' },
  h265: { segExt: 'ts', hlsSegType: 'mpegts' },
  av1: { segExt: 'm4s', hlsSegType: 'fmp4' },
  vp9: { segExt: 'm4s', hlsSegType: 'fmp4' },
}

export const config = {
  name: 'StreamProcess',
  description: 'Process using FFmpeg for multi-device, multi-resolution, multi-codec HLS streaming',
  flows: ['live-stream-flow'],
  triggers: [
    queue('stream.process', {
      input: z.object({
        slug: z.string(),
        deviceId: z.string(),
        renditions: z.array(renditionSchema).optional(),
        codecs: z.array(codecSchema).optional(),
      }),
    }),
  ],
  enqueues: [
    { topic: 'stream.ready', label: 'Stream is live' },
    { topic: 'stream.error', label: 'Stream failed' },
  ],
} as const satisfies StepConfig

function buildFFmpegArgsForCodec(slug: string, deviceId: string, deviceDir: string, renditions: Rendition[], codec: Codec, includeOriginal: boolean): string[] {
  const args: string[] = ['-i', `srt://${import.meta.env.MOTIA_SRT_HOST}:${import.meta.env.MOTIA_SRT_PORT}?streamid=live/${slug}/${deviceId}&mode=listener&pkt_size=1316`]

  if (includeOriginal) {
    args.push(
      '-map',
      '0:v',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-f',
      'mp4',
      '-movflags',
      '+frag_keyframe+empty_moov+default_base_moof',
      join(deviceDir, 'original', `recording-${Date.now()}.mp4`)
    )
  }

  const { encoder, preset, tune, segExt, hlsSegType } = {
    ...CODEC_CONFIG[codec],
    ...CODEC_HLS_FORMAT[codec],
  }

  for (const r of renditions) {
    const variantDir = join(deviceDir, 'hls', `${r.name}-${codec}`)
    const vf = `scale=${r.width}:${r.height}:force_original_aspect_ratio=decrease,pad=${r.width}:${r.height}:(ow-iw)/2:(oh-ih)/2`
    const isRatelessCodec = codec === 'av1' || codec === 'vp9'

    args.push(
      '-map',
      '0:v',
      '-map',
      '0:a?',
      '-vf',
      vf,
      '-c:v',
      encoder,
      ...(preset ? ['-preset', preset] : []),
      ...(tune ? ['-tune', tune] : []),
      ...CODEC_EXTRA_ARGS[codec],
      '-b:v',
      r.videoBitrate,
      ...(!isRatelessCodec ? ['-maxrate', r.maxRate, '-bufsize', r.bufSize] : []),
      '-c:a',
      'aac',
      '-b:a',
      r.audioBitrate,
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '7',
      '-hls_flags',
      'delete_segments+append_list+independent_segments',
      '-hls_segment_type',
      hlsSegType,
      '-hls_segment_filename',
      join(variantDir, `seg%03d.${segExt}`),
      join(variantDir, 'index.m3u8')
    )
  }

  return args
}

async function writeMasterPlaylist(deviceDir: string, renditions: Rendition[], codecs: Codec[]): Promise<void> {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3']

  for (const codec of codecs) {
    const { bandwidth } = CODEC_CONFIG[codec]
    const codecStr = CODEC_STRINGS[codec]

    for (const r of renditions) {
      const bw = Math.round(parseInt(r.videoBitrate) * 1000 * bandwidth)
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${r.width}x${r.height},CODECS="${codecStr}"`, `${r.name}-${codec}/index.m3u8`)
    }
  }

  await writeFile(join(deviceDir, 'hls', 'master.m3u8'), lines.join('\n'))
}

export const handler: Handlers<typeof config> = async ({ slug, deviceId }, { enqueue, logger, state }) => {
  const renditions = DEFAULT_RENDITIONS
  const codecs = DEFAULT_CODECS
  const deviceDir = join(process.cwd(), 'static', 'stream', slug, deviceId)

  await mkdir(join(deviceDir, 'original'), { recursive: true })
  for (const codec of codecs) {
    for (const r of renditions) {
      await mkdir(join(deviceDir, 'hls', `${r.name}-${codec}`), { recursive: true })
    }
  }
  await writeMasterPlaylist(deviceDir, renditions, codecs)

  for (const [index, codec] of codecs.entries()) {
    const procKey = `${slug}:${deviceId}:${codec}`

    if (hasProcess(procKey)) {
      logger.warn(`Stream ${procKey} already running, skipping`)
      continue
    }

    const args = buildFFmpegArgsForCodec(
      slug,
      deviceId,
      deviceDir,
      renditions,
      codec,
      index === 0 // only first codec captures original recording
    )

    logger.info(`Spawning FFmpeg [${codec}] for ${slug}:${deviceId} — ${renditions.length} renditions`)

    const proc = execa('ffmpeg', args, { reject: false })
    proc.stderr?.on('data', (d) => logger.info(`[ffmpeg:${procKey}] ${d.toString().trim()}`))
    proc.on('exit', async (code) => {
      deregisterProcess(procKey, state)
      logger.info(`[${procKey}] exited with code ${code}`)
      await enqueue({ topic: 'stream.error', data: { slug: slug, deviceId, codec, code } })
    })
    registerProcess(procKey, proc, { slug: slug, deviceId, codec }, state)
  }

  await enqueue({ topic: 'stream.ready', data: { slug: slug, deviceId } })

  return { status: 200, body: '' }
}
