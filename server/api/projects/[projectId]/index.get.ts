import { defineEventHandler, getRouterParam, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import type { Resource } from '~/server/types'

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = Math.max(decimals, 0)
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default defineEventHandler(async (event) => {
  try {
    const projectId = getRouterParam(event, 'projectId')!.toString().replace(/,$/, '')

    const projectStorage = useStorage<Resource<'project'>>(`data:resource:project`)
    const mediaStorage = useStorage<Resource<'media'>>(`data:resource:media`)

    const projectKeys = await projectStorage.getKeys()
    const projects = (await projectStorage.getItems(projectKeys)).flatMap(({ value }) => value?.record || [])
    const project = projects.find(({ properties }) => properties.Slug.formula.string === projectId)

    if (!project) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    const mediaKeys = await mediaStorage.getKeys()
    const allMedia = (await mediaStorage.getItems(mediaKeys)).flatMap(({ value }) => value?.record || [])
    const projectMedia = allMedia.filter((m) => m.properties['Project Slug']?.rollup?.array[0]?.formula?.string === projectId)

    const stats = {
      totals: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes' },
      breakdown: {
        photo: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes', approval: { total: 0, approved: 0, notApproved: 0, pending: 0 } },
        video: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes', approval: { total: 0, approved: 0, notApproved: 0, pending: 0 } },
        audio: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes', approval: { total: 0, approved: 0, notApproved: 0, pending: 0 } },
      },
    }

    for (const m of projectMedia) {
      const rawType = m.properties.Type?.select?.name?.toLowerCase() || 'photo'
      const type = (['photo', 'video', 'audio'].includes(rawType) ? rawType : 'photo') as 'photo' | 'video' | 'audio'
      const status = m.properties.Status?.status?.name?.toLowerCase() || 'pending'

      const sizeBytes = m.properties.Size?.number || 5_000_000

      stats.totals.count += 1
      stats.totals.storageBytes += sizeBytes

      const category = stats.breakdown[type]
      category.count += 1
      category.storageBytes += sizeBytes
      category.approval.total += 1

      if (status === 'approved') {
        category.approval.approved += 1
      } else if (status === 'not approved' || status === 'rejected') {
        category.approval.notApproved += 1
      } else {
        category.approval.pending += 1
      }
    }

    stats.totals.humanReadableStorage = formatBytes(stats.totals.storageBytes)
    stats.breakdown.photo.humanReadableStorage = formatBytes(stats.breakdown.photo.storageBytes)
    stats.breakdown.video.humanReadableStorage = formatBytes(stats.breakdown.video.storageBytes)
    stats.breakdown.audio.humanReadableStorage = formatBytes(stats.breakdown.audio.storageBytes)

    return {
      id: projectId,
      orgId: 'org_red-cat-pictures-1',
      name: project.properties.Name?.title?.[0]?.plain_text || 'Untitled Project',
      status: project.properties.Status?.status?.name?.toLowerCase() || 'active',
      createdAt: project.created_time,
      updatedAt: project.last_edited_time,
      config: {
        watermarkEnabled: project.properties.Watermark?.checkbox || true,
      },
      mediaSummary: stats,
    }
  } catch (error: any) {
    console.error('API /projects/[projectId] GET Error:', error)
    throw new HTTPError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
    })
  }
})
