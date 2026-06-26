import { defineEventHandler, readValidatedBody, HTTPError } from 'nitro/h3'
import { z } from 'zod'
import { useStorage } from 'nitro/storage'
import notion from '~/server/utils/notion'
import type { Resource } from '~/server/types'

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('delete'),
    mediaIds: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('approve'),
    mediaIds: z.array(z.string()).min(1),
    params: z.object({ status: z.enum(['approved', 'rejected', 'pending']) }),
  }),
  z.object({
    action: z.literal('move'),
    mediaIds: z.array(z.string()).min(1),
    params: z.object({ targetProjectId: z.string() }),
  }),
])

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, (data) => actionSchema.parse(data))

    switch (body.action) {
      // ==========================================
      // ACTION: DELETE (Soft Archive in Notion)
      // ==========================================
      case 'delete': {
        await Promise.all(
          body.mediaIds.map((id) =>
            notion.pages.update({
              page_id: id,
              archived: true,
            })
          )
        )

        return {
          success: true,
          updatedCount: body.mediaIds.length,
          message: `${body.mediaIds.length} items moved to trash (30-day retention).`,
          data: null,
        }
      }

      // ==========================================
      // ACTION: APPROVE / STATUS CHANGE
      // ==========================================
      case 'approve': {
        const formattedStatus = body.params.status.charAt(0).toUpperCase() + body.params.status.slice(1)
        const now = new Date().toDateString()

        await Promise.all(
          body.mediaIds.map((id) =>
            notion.pages.update({
              page_id: id,
              properties: {
                Status: {
                  status: { name: formattedStatus },
                },
              },
            })
          )
        )

        const updatedAssets = body.mediaIds.map((id) => ({
          mediaId: id,
          status: body.params.status,
          updatedAt: now,
        }))

        return {
          success: true,
          updatedCount: body.mediaIds.length,
          message: 'Media approval state updated successfully.',
          data: {
            assets: updatedAssets,
          },
        }
      }

      // ==========================================
      // ACTION: MOVE TO NEW PROJECT
      // ==========================================
      case 'move': {
        const { targetProjectId } = body.params
        const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)

        const projectKeys = await projectStorage.getKeys()
        const projects = (await projectStorage.getItems(projectKeys)).flatMap(({ value }) => value?.record || [])
        const targetProjectExists = projects.some((p) => p.id === targetProjectId || p.properties.Slug?.formula?.string === targetProjectId)

        if (!targetProjectExists) {
          throw new HTTPError({ statusCode: 404, statusMessage: 'Target project not found' })
        }

        const targetNotionId = projects.find((p) => p.properties.Slug?.formula?.string === targetProjectId)?.id || targetProjectId

        await Promise.all(
          body.mediaIds.map((id) =>
            notion.pages.update({
              page_id: id,
              properties: {
                Project: {
                  relation: [{ id: targetNotionId }],
                },
              },
            })
          )
        )

        return {
          success: true,
          updatedCount: body.mediaIds.length,
          message: `${body.mediaIds.length} assets successfully relocated to target project.`,
          data: null,
        }
      }
    }
  } catch (error: any) {
    console.error('API /media/action POST Error:', error)
    throw new HTTPError({
      statusCode: error.status || error.statusCode || 500,
      statusMessage: error.message || 'Internal Server Error',
    })
  }
})
