/* eslint-disable unicorn/no-array-reduce */
import { defineEventHandler, HTTPError, readValidatedBody } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'
import type { NotionDB, Resource } from '~/server/types'
import notion from '~/server/utils/notion'

export default defineEventHandler(async (event) => {
  try {
    const { batchId, uploadId, filename, status, progressPercent, mediaId, error, data } = await readValidatedBody(
      event,
      z.object({
        batchId: z.string().optional(),
        uploadId: z.string().optional(),
        filename: z.string(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
        progressPercent: z.number(),
        mediaId: z.string().nullable(),
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
    const notionDbId = JSON.parse(config.private.notionDbId) as unknown as NotionDB

    const parts = filename.split('.')[0]?.split('-') || []
    const orgIndex = Number.parseInt(parts[1], 10)
    const projectIndex = Number.parseInt(parts[2], 10)
    const mediaIndex = Number.parseInt(parts[3], 10)
    const versiontIndex = Number.parseInt(parts[4], 10)

    const orgStorage = useStorage<Resource<'organization'>>('data:resource:organization')
    const projectStorage = useStorage<Resource<'project'>>('data:resource:project')

    const orgs = (await orgStorage.getItems(await orgStorage.getKeys())).flatMap(({ value }) => value?.record || [])
    const projects = (await projectStorage.getItems(await projectStorage.getKeys())).flatMap(({ value }) => value?.record || [])

    const targetOrg = Number.isNaN(orgIndex) ? null : orgs.find((o) => o.properties?.Index?.number === orgIndex)
    const targetProject = Number.isNaN(projectIndex) ? null : projects.find((p) => p.properties?.Index?.number === projectIndex)

    let finalMediaId = mediaId

    if (data?.metadata) {
      const notionProperties: any = {
        Name: { title: [{ text: { content: filename } }] },
        Index: { number: mediaIndex },
        'Version Index': { number: versiontIndex },
        Type: { select: { name: data.metadata.kind === 'video' ? 'Video' : 'Photo' } },
        Status: { status: { name: status === 'completed' ? 'Draft' : 'Plan' } },
      }

      if (targetProject) notionProperties.Project = { relation: [{ id: targetProject.id }] }
      if (targetOrg) notionProperties.Organization = { relation: [{ id: targetOrg.id }] }

      if (data.metadata.format) {
        const { width, height } = data.metadata.format

        const ratio = width / height
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

    if (batchId && uploadId) {
      const batchData = await uploadMetaStorage.getItem<{
        projectId: string
        uploads: {
          uploadId: string
          filename: string
          status: string
          progressPercent: number
          mediaId: string | null
          error: string | null
        }[]
      }>(batchId)

      if (batchData && Array.isArray(batchData.uploads)) {
        batchData.uploads = batchData.uploads.map((upload) => {
          if (upload.uploadId === uploadId) {
            return {
              ...upload,
              status,
              progressPercent,
              mediaId: finalMediaId,
              error,
            }
          }
          return upload
        })

        await uploadMetaStorage.setItem(batchId, batchData)
      }
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
