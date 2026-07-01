import { defineEventHandler, HTTPError, readValidatedBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { randomUUID } from 'uncrypto'
import z from 'zod'
import type { Resource } from '~/server/types'

import r2Drive from '~/server/utils/r2-drive'
import r2GetPresignedUploadUrl from '~/server/utils/r2-get-presigned-upload-url'

const uploadSchema = z.object({ orgId: z.string(), projectId: z.string(), files: z.array(z.object({ filename: z.string(), mimeType: z.string(), sizeBytes: z.number() })) })

export default defineEventHandler(async (event) => {
  try {
    const { orgId, projectId, files } = await readValidatedBody(event, uploadSchema)

    const batchId = `batch_${randomUUID().slice(0, 8)}`
    const uploadMetaStorage = useStorage('data:upload')
    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)
    const mediaStorage = useStorage<Resource<'media'>>(`data:resource:media`)
    const orgStorage = useStorage<Resource<'organization'>>(`data:resource:organization`)

    // 1. Resolve Organization Index
    const orgKeys = await orgStorage.getKeys()
    const orgs = (await orgStorage.getItems(orgKeys)).flatMap(({ value }) => value?.record || [])
    const org = orgs.find((o) => o.id === orgId || o.properties?.Id?.rich_text?.[0]?.text?.content === orgId)
    const orgIndexStr = String(org?.properties?.Index?.number || 0).padStart(4, '0')

    // 2. Resolve Project Index
    const projectKeys = await projectStorage.getKeys()
    const projects = (await projectStorage.getItems(projectKeys)).flatMap(({ value }) => value?.record || [])
    const project = projects.find((p) => p.id === projectId || p.properties?.Slug?.formula?.string === projectId)
    const projectIndexStr = String(project?.properties?.Index?.number || 0).padStart(4, '0')

    // 3. Resolve base Media count for this project
    const mediaKeys = await mediaStorage.getKeys()
    const allMedia = (await mediaStorage.getItems(mediaKeys)).flatMap(({ value }) => value?.record || [])

    // Safely check if the media belongs to the target project
    const projectMedia = allMedia.filter((m) => m.properties?.Project?.relation?.some((r) => r.id === project?.id) || m.properties?.['Project Slug']?.rollup?.array?.[0]?.formula?.string === projectId)

    let currentMediaCount = projectMedia.length

    const uploadsResponse = []
    const initialStatusList = []

    for (const file of files) {
      const uploadId = `up_${randomUUID().slice(0, 8)}`
      const dotIdx = file.filename.lastIndexOf('.')
      const ext = dotIdx > 0 ? file.filename.slice(dotIdx) : ''

      // 4. Compute dynamic naming convention (e.g., photo-0003-0008-0001-001)
      currentMediaCount += 1
      const mediaIndexStr = String(currentMediaCount).padStart(4, '0')
      const versionIndexStr = '001' // Assume new files are v1 unless explicitly versioning via UI
      const prefix = file.mimeType.startsWith('video') ? 'video' : 'photo'

      const generatedName = `${prefix}-${orgIndexStr}-${projectIndexStr}-${mediaIndexStr}-${versionIndexStr}`
      const newFilename = `${generatedName}${ext}`

      const objectKey = `upload/${orgId}/${projectId}/${generatedName}${ext}`

      const uploadUrl = await r2GetPresignedUploadUrl(r2Drive, `${process.env.NITRO_PRIVATE_DRIVE_R2_ENDPOINT}/${process.env.NITRO_PRIVATE_DRIVE_R2_BUCKET}`, objectKey, file.mimeType)

      uploadsResponse.push({
        filename: newFilename,
        uploadId,
        uploadUrl,
      })

      initialStatusList.push({
        uploadId,
        filename: newFilename, // Save with the new naming convention
        status: 'pending',
        progressPercent: 0,
        mediaId: null,
        error: null,
      })
    }

    await uploadMetaStorage.setItem(batchId, {
      projectId,
      uploads: initialStatusList,
    })

    return { batchId, uploads: uploadsResponse }
  } catch (error: any) {
    console.error('API /media/uploads POST Error:', error)

    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
