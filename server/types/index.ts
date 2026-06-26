export const CODEC_MAP: Record<string, { short: string; long: string }> = {
  h264: { short: 'avc', long: 'avc1.640020' },
  avc: { short: 'avc', long: 'avc1.640020' },
  h265: { short: 'hevc', long: 'hev1' },
  hevc: { short: 'hevc', long: 'hev1' },
  av1: { short: 'av1', long: 'av01.0.08M.08' },
  vp9: { short: 'vp9', long: 'vp09.00.40.08' },
}

export const codecs = ['avc', 'vp9', 'hevc', 'av1'] as const
export type Codec = (typeof codecs)[number]

export const devices = ['cpu', 'gpu'] as const
export type Device = (typeof devices)[number]

export const resolutions = ['1440p', '1080p', '720p'] as const
export type Resolution = (typeof resolutions)[number]

export const resourceTypes = ['project', 'media', 'contact'] as const

export type ResourceType = (typeof resourceTypes)[number]

export type NotionDB = { [K in ResourceType]: string }

export interface ResourceRecordMap {
  project: NotionProject
  media: NotionMedia
  contact: NotionContact
}

export interface Resource<T extends ResourceType = ResourceType> {
  type: T
  notificationStatus: boolean
  record: ResourceRecordMap[T]
}

type NotionImage =
  | {
      type: 'file'
      file: {
        url: string
        expiry_time: string
      }
    }
  | {
      type: 'external'
      external: {
        url: string
      }
    }
  | null

export interface NotionProject {
  id: string
  created_time: Date
  last_edited_time: Date
  cover: NotionImage
  icon: NotionImage
  properties: {
    Index: {
      type: 'number'
      number: number
    }
    Name: {
      type: 'title'
      title: {
        plain_text: string
      }[]
    }
    Slug: {
      type: 'formula'
      formula: { string: string }
    }
    Status: {
      type: 'status'
      status: {
        name: 'Plan' | 'Quotation' | 'Shoot' | 'Edit' | 'Delivered'
      }
    }
    Quotation: {
      type: 'number'
      number: number
    }
    Address: {
      type: 'rich_text'
      rich_text: {
        text: {
          content: string
        }
      }[]
    }
    Date: {
      type: 'date'
      date: {
        start: string
        end: string
      }
    }
    Contact: {
      type: 'relation'
      relation: { id: string }[]
      has_more: boolean
    }
    Budget: {
      type: 'number'
      number: number
    }
    Asset: {
      type: 'relation'
      relation: { id: string }[]
      has_more: boolean
    }
  }
  url: string
  public_url: null
}

export interface NotionMedia {
  id: string
  created_time: string
  last_edited_time: string
  cover: NotionImage
  icon: NotionImage
  properties: {
    Index: {
      type: 'number'
      number: number
    }
    'Project Index': {
      type: 'rollup'
      rollup: {
        array: {
          number: number
        }[]
      }
    }
    Name: {
      type: 'title'
      title: {
        plain_text: string
      }[]
    }
    Slug: {
      type: 'formula'
      formula: { string: string }
    }
    'Project Slug': {
      type: 'rollup'
      rollup: {
        array: {
          formula: {
            string: string
          }
        }[]
      }
    }
    Description: {
      type: 'rich_text'
      rich_text: {
        text: {
          content: string
        }
      }[]
    }
    Type: {
      type: 'select'
      select: {
        name: 'Photo' | 'Video'
      }
    }
    Status: {
      type: 'select'
      status: {
        name: 'Plan' | 'Draft' | 'Release' | 'Archive'
      }
    }
    Project: {
      type: 'relation'
      relation: { id: string }[]
      has_more: false
    }
    Gallery: {
      type: 'checkbox'
      checkbox: boolean
    }
    Featured: {
      type: 'number'
      number: number
    }
    Resolution: {
      type: 'select'
      select: {
        name: Resolution
      }
    }
    'Aspect ratio': {
      type: 'select'
      select: {
        name: AspectRatio
      }
    }
    Additional: {
      type: 'rich_text'
      rich_text: {
        text: {
          content: string
        }
      }[]
    }
  }
}

export interface NotionContact {
  id: string
  created_time: Date
  last_edited_time: Date
  cover: NotionImage
  icon: NotionImage
  properties: {
    Name: {
      type: 'title'
      title: {
        plain_text: string
      }[]
    }
    Company: {
      type: 'rich_text'
      rich_text: {
        text: {
          content: string
        }
      }[]
    }
    Address: {
      type: 'rich_text'
      rich_text: {
        text: {
          content: string
        }
      }[]
    }
    Website: {
      type: 'url'
      url: string
    }
    Instagram: {
      type: 'url'
      url: string
    }
    LinkedIn: {
      type: 'url'
      url: string
    }
    'Point of Contact': {
      type: 'select'
      select: {
        name: string
        color: string
      }
    }
    Email: {
      type: 'email'
      email: string
    }
    Whatsapp: {
      type: 'phone_number'
      phone_number: string
    }
    Phone: {
      type: 'phone_number'
      phone_number: string
    }
    Project: {
      type: 'relation'
      relation: { id: string }[]
      has_more: boolean
    }
    Profit: {
      type: 'rollup'
      rollup: {
        type: string
        number: null
        function: string
      }
    }
    Organization: {
      type: 'relation'
      relation: { id: string }[]
    }
  }
  url: string
  public_url: null
}
