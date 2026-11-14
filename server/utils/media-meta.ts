import notionTextStringify from '~/server/utils/notion-text-stringify'

type NotionMediaProps = Record<string, any>

export type MediaExif = {
  camera?: string
  lens?: string
  shutter?: string
  iso?: number
  colorProfile?: string
  location?: string
}

/** Extra per-file facts stored on the Notion media page. Missing values are null. */
export default function mediaMeta(properties: NotionMediaProps, createdTime: string) {
  const text = (key: string) => {
    const value = properties[key]?.rich_text
    return Array.isArray(value) && value.length > 0 ? notionTextStringify(value) : null
  }

  let exif: MediaExif | null = null
  const rawExif = text('EXIF')
  if (rawExif) {
    try {
      exif = JSON.parse(rawExif) as MediaExif
    } catch {
      exif = null
    }
  }

  return {
    createdAt: createdTime,
    version: properties['Version Index']?.number ?? 1,
    sizeBytes: (properties.Size?.number as number | null | undefined) ?? null,
    durationSec: (properties.Duration?.number as number | null | undefined) ?? null,
    uploadedBy: text('Uploaded By'),
    exif,
  }
}
