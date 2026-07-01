import { defineEventHandler, getRouterParam, HTTPError } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import type { Resource } from '~/server/types'
import formatBytes from '~/server/utils/format-bytes'
import notionNormalizeId from '~/server/utils/notion-normalize-id'

export default defineEventHandler(async (event) => {
  try {
    const projectId = notionNormalizeId(getRouterParam(event, 'projectId')!.toString().replace(/,$/, ''))

    const projectStorage = useStorage<Resource<'project'>>('data:resource:project')
    const mediaStorage = useStorage<Resource<'media'>>('data:resource:media')

    const project = await projectStorage.getItem(projectId)

    if (!project) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    const mediaKeys = await mediaStorage.getKeys()
    const allMedia = (await mediaStorage.getItems(mediaKeys)).flatMap(({ value }) => value?.record || [])
    const projectMedia = allMedia.filter(({ properties }) => properties['Project Slug']?.rollup?.array[0]?.formula?.string === project.record.properties.Slug.formula.string)

    const baseApproval = () => ({ total: 0, plan: 0, draft: 0, approved: 0, notApproved: 0, release: 0, archive: 0 })

    const stats = {
      totals: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes' },
      breakdown: {
        photo: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes', approval: baseApproval() },
        video: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes', approval: baseApproval() },
        audio: { count: 0, storageBytes: 0, humanReadableStorage: '0 Bytes', approval: baseApproval() },
      },
    }

    for (const media of projectMedia) {
      const rawType = media.properties.Type?.select?.name?.toLowerCase() || 'photo'
      const type = (['photo', 'video', 'audio'].includes(rawType) ? rawType : 'photo') as 'photo' | 'video' | 'audio'
      const status = media.properties.Status?.status?.name?.toLowerCase() || 'draft'

      const sizeBytes = media.properties.Size?.number || 5_000_000

      stats.totals.count += 1
      stats.totals.storageBytes += sizeBytes

      const category = stats.breakdown[type]
      category.count += 1
      category.storageBytes += sizeBytes
      category.approval.total += 1

      // Route the status precisely to the requested tracking keys
      switch (status) {
        case 'plan': {
          category.approval.plan += 1

          break
        }
        case 'draft': {
          category.approval.draft += 1

          break
        }
        case 'approved': {
          category.approval.approved += 1

          break
        }
        case 'not approved':
        case 'notapproved':
        case 'rejected': {
          category.approval.notApproved += 1

          break
        }
        case 'release': {
          category.approval.release += 1

          break
        }
        case 'archive': {
          category.approval.archive += 1

          break
        }
        default: {
          // Fallback for any unknown, legacy 'pending', or blank statuses
          category.approval.draft += 1
        }
      }
    }

    stats.totals.humanReadableStorage = formatBytes(stats.totals.storageBytes)
    stats.breakdown.photo.humanReadableStorage = formatBytes(stats.breakdown.photo.storageBytes)
    stats.breakdown.video.humanReadableStorage = formatBytes(stats.breakdown.video.storageBytes)
    stats.breakdown.audio.humanReadableStorage = formatBytes(stats.breakdown.audio.storageBytes)

    return {
      id: projectId,
      orgId: 'org_red-cat-pictures-1',
      name: project.record.properties.Name?.title?.[0]?.plain_text || 'Untitled Project',
      status: project.record.properties.Status?.status?.name?.toLowerCase() || 'active',
      createdAt: project.record.created_time,
      updatedAt: project.record.last_edited_time,
      config: {
        watermarkEnabled: project.record.properties.Watermark?.checkbox || true,
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
