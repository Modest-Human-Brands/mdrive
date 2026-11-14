/* eslint-disable unicorn/no-array-reduce */
import { defineEventHandler, HTTPError, readValidatedBody } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import type { NotionDB, Resource } from '~/server/types'
import findMediaPage from '~/server/utils/find-media-page'
import notion from '~/server/utils/notion'
import notionNormalizeId from '~/server/utils/notion-normalize-id'

/** Turns 1.5, "1.5" or "3:2" into a width/height number, or null. */
function parseAspectRatio(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 ? value : null
  if (typeof value !== 'string') return null

  const [w, h] = value.split(':').map(Number)
  if (h === undefined) return w > 0 ? w : null
  return w > 0 && h > 0 ? w / h : null
}

export default defineEventHandler(async (event) => {
  try {
    const { batchId, uploadId, filename, status, progressPercent, error, data } = await readValidatedBody(
      event,
      z.object({
        batchId: z.string().optional(),
        uploadId: z.string().optional(),
        filename: z.string(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
        progressPercent: z.number(),
        // Accepted for compatibility but never trusted: the page id is resolved here.
        mediaId: z.string().nullable().optional(),
        projectId: z.string().optional(),
        error: z.string().nullable(),
        data: z
          .object({
            metadata: z.any().optional(),
          })
          .nullable()
          .optional(),
      })
    )

    const uploadMetaStorage = useStorage('data:upload')
    const config = useRuntimeConfig()
    const rawDbId = config.private.notionDbId
    const notionDbId = (typeof rawDbId === 'string' ? JSON.parse(rawDbId) : rawDbId) as unknown as NotionDB

    const nameKey = filename.replace(/\.[^.]+$/, '')
    const parts = nameKey.split('-')
    const orgIndex = Number.parseInt(parts[1], 10)
    const projectIndex = Number.parseInt(parts[2], 10)
    const mediaIndex = Number.parseInt(parts[3], 10)
    const versiontIndex = Number.parseInt(parts[4], 10)

    if ([orgIndex, projectIndex, mediaIndex, versiontIndex].some((n) => Number.isNaN(n))) {
      throw new HTTPError({ statusCode: 400, statusMessage: 'Filename must look like <kind>-<org>-<project>-<media>-<version>' })
    }

    // Which upload does this callback belong to? Callbacks may omit the batch.
    const batchRef = batchId && uploadId ? { batchId, uploadId } : await useStorage<{ batchId: string; uploadId: string }>('data:upload-file').getItem(nameKey)
    if (!batchRef) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Unknown upload filename' })
    }

    const orgStorage = useStorage<Resource<'organization'>>('data:resource:organization')
    const projectStorage = useStorage<Resource<'project'>>('data:resource:project')

    const orgs = (await orgStorage.getItems(await orgStorage.getKeys())).flatMap(({ value }) => value?.record || [])
    const projects = (await projectStorage.getItems(await projectStorage.getKeys())).flatMap(({ value }) => value?.record || [])

    const targetOrg = orgs.find((o) => o.properties?.Index?.number === orgIndex)

    type UploadRow = { uploadId: string; filename: string; status: string; progressPercent: number; mediaId: string | null; error: string | null }
    type BatchData = { projectId: string; uploads: UploadRow[] }

    const batchData = await uploadMetaStorage.getItem<BatchData>(batchRef.batchId)
    const uploadRow = batchData?.uploads?.find((u) => u.uploadId === batchRef.uploadId)

    // Prefer the project the batch was created for; fall back to the index in the name.
    const batchProjectKey = batchData?.projectId ? notionNormalizeId(batchData.projectId) : null
    const targetProject = (batchProjectKey && projects.find((p) => notionNormalizeId(p.id) === batchProjectKey)) || projects.find((p) => p.properties?.Index?.number === projectIndex) || null

    // The page id is ours: reuse what an earlier callback stored, else look the page up by indexes.
    let finalMediaId: string | null = uploadRow?.mediaId ?? null
    if (!finalMediaId && targetProject) {
      finalMediaId = await findMediaPage(targetProject.id, notionDbId.media, mediaIndex, versiontIndex)
    }

    if (data?.metadata) {
      const notionProperties: any = {
        Name: { title: [{ text: { content: filename } }] },
        Index: { number: mediaIndex },
        'Version Index': { number: versiontIndex },
        Type: { select: { name: data.metadata.kind === 'video' ? 'Video' : 'Photo' } },
        Status: { status: { name: status === 'completed' ? 'Pending' : 'Plan' } },
      }

      if (targetProject) notionProperties.Project = { relation: [{ id: targetProject.id }] }
      if (targetOrg) notionProperties.Organization = { relation: [{ id: targetOrg.id }] }

      const format = data.metadata.format ?? {}
      const width = Number(format.width)
      const height = Number(format.height)
      const hasSize = width > 0 && height > 0

      // Width and height win; otherwise use the processor's aspectRatio (number or "w:h").
      const ratio = hasSize ? width / height : parseAspectRatio(format.aspectRatio)

      if (ratio) {
        const standardRatios = [
          { name: '16:9', val: 16 / 9 },
          { name: '3:2', val: 3 / 2 },
          { name: '4:3', val: 4 / 3 },
          { name: '1:1', val: 1 },
          { name: '3:4', val: 3 / 4 },
          { name: '2:3', val: 2 / 3 },
          { name: '9:16', val: 9 / 16 },
        ]

        const closestRatio = standardRatios.reduce((prev, curr) => (Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev))
        notionProperties['Aspect ratio'] = { select: { name: closestRatio.name } }
      }

      // Without real dimensions there is no honest resolution, so leave it unset.
      if (hasSize) {
        const shortSide = Math.min(width, height)
        const standardResolutions = [
          { name: '4320p', val: 4320 },
          { name: '2160p', val: 2160 },
          { name: '1440p', val: 1440 },
          { name: '1080p', val: 1080 },
          { name: '720p', val: 720 },
        ]

        const closestRes = standardResolutions.reduce((prev, curr) => (Math.abs(curr.val - shortSide) < Math.abs(prev.val - shortSide) ? curr : prev))
        notionProperties.Resolution = { select: { name: closestRes.name } }
      }

      // File facts and EXIF come from the media processor; each is optional.
      const meta = data.metadata
      const sizeBytes = Number(meta.sizeBytes ?? meta.format?.size)
      if (Number.isFinite(sizeBytes) && sizeBytes > 0) notionProperties.Size = { number: sizeBytes }

      const durationSec = Number(meta.durationSec ?? meta.format?.duration)
      if (Number.isFinite(durationSec) && durationSec > 0) notionProperties.Duration = { number: durationSec }

      if (typeof meta.uploadedBy === 'string' && meta.uploadedBy.trim()) {
        notionProperties['Uploaded By'] = { rich_text: [{ text: { content: meta.uploadedBy.trim().slice(0, 200) } }] }
      }

      // MMedia sends `exif`; older senders put the same keys at the top level.
      const exifSource = meta.exif && typeof meta.exif === 'object' ? meta.exif : meta
      const { camera, lens, shutter, iso, colorProfile, location } = exifSource
      const exif = { camera, lens, shutter, iso, colorProfile, location }
      if (Object.values(exif).some((v) => v !== undefined && v !== null && v !== '')) {
        const exifJson = JSON.stringify(exif)
        // A Notion text chunk holds 2000 characters; the fixed keys stay well under that.
        if (exifJson.length <= 2000) notionProperties.EXIF = { rich_text: [{ text: { content: exifJson } }] }
      }

      if (finalMediaId) {
        await notion.pages.update({ page_id: finalMediaId, properties: notionProperties })
      } else {
        const newPage = await notion.pages.create({
          parent: { data_source_id: notionDbId.media },
          properties: notionProperties,
        })
        finalMediaId = newPage.id
      }
    }

    if (batchData && Array.isArray(batchData.uploads)) {
      batchData.uploads = batchData.uploads.map((upload) => (upload.uploadId === batchRef.uploadId ? { ...upload, status, progressPercent, mediaId: finalMediaId ?? upload.mediaId, error } : upload))

      await uploadMetaStorage.setItem(batchRef.batchId, batchData)
    }

    return { success: true }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    console.error('Route webhook/uploads PUT Error:', error)
    throw new HTTPError({ statusCode: 500, message: 'Some Unknown Error Found' })
  }
})
