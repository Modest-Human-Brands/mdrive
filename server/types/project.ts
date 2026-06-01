import type { ProjectClient, ProjectStatus } from './index'

export type MediaType = 'photo' | 'video'

export type MediaMetadata = {
  size: number
  resolution: string
  aspectRatio: string
  bitDepth: string
  fps?: number
}

export type MediaItem = {
  slug: string
  type: MediaType
  title: string
  thumbnailUrl?: string
  metadata: MediaMetadata
}

export type ProjectDetail = {
  slug: string
  title: string
  date: string
  status: ProjectStatus
  client: ProjectClient
  mediaCount: {
    photo: number
    video: number
  }
  mediaItems: MediaItem[]
}
