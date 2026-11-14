import { defineEventHandler, getRouterParam, HTTPError, readValidatedBody } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { useStorage } from 'nitro/storage'
import { z } from 'zod'

import type { NotionDB, Resource } from '~/server/types'
import notion from '~/server/utils/notion'
import notionNormalizeId from '~/server/utils/notion-normalize-id'
import notionQueryDb from '~/server/utils/notion-query-db'

const reviewSchema = z.object({
  note: z.string().trim().max(2000).optional(),
})

const DECIDED = new Set(['plan', 'approved', 'release', 'archive'])

type MediaPage = { properties: { Status?: { status?: { name?: string } } } }

/**
 * Submit a client's review. Statuses are already set per file through
 * POST /api/media/action, so this only checks nothing is pending and records
 * the note and time on the project page.
 *
 * Requires the Projects database to have "Review Note" (text) and "Reviewed At" (date).
 */
export default defineEventHandler(async (event) => {
  try {
    const projectId = notionNormalizeId(getRouterParam(event, 'projectId')!.toString().replace(/,$/, ''))
    const { note } = await readValidatedBody(event, (data) => reviewSchema.parse(data))

    const project = (await useStorage<Resource<'project'>>('data:resource:project').getItem(projectId))?.record

    if (!project) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    // Live query: the cached media can lag behind approvals made through the API.
    const config = useRuntimeConfig()
    const rawDbId = config.private.notionDbId
    const notionDbId = (typeof rawDbId === 'string' ? JSON.parse(rawDbId) : rawDbId) as unknown as NotionDB

    const media = await notionQueryDb<MediaPage>(notion, notionDbId.media, {
      filter: { property: 'Project', relation: { contains: project.id } },
    })

    const summary = { pending: 0, rejected: 0 }
    for (const { properties } of media) {
      const status = properties.Status?.status?.name?.toLowerCase() || 'pending'
      if (status === 'rejected') summary.rejected += 1
      // Same rule as the project summary: anything not decided or released counts as pending.
      else if (!DECIDED.has(status)) summary.pending += 1
    }

    if (summary.pending > 0) {
      throw new HTTPError({
        statusCode: 409,
        statusMessage: `${summary.pending} file(s) are still pending. Approve or reject them before submitting.`,
      })
    }

    const submittedAt = new Date().toISOString()

    await notion.pages.update({
      page_id: project.id,
      properties: {
        'Review Note': { rich_text: note ? [{ text: { content: note } }] : [] },
        'Reviewed At': { date: { start: submittedAt } },
      },
    })

    return { projectId, summary, submittedAt }
  } catch (error: any) {
    console.error('API projects/[projectId]/review POST Error:', error)

    throw new HTTPError({
      statusCode: error.status || error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal Server Error',
    })
  }
})
