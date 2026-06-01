import { Client } from '@notionhq/client'

const notionClientSingleton = () => {
  return new Client({ auth: process.env.NOTION_API_KEY })
}

// eslint-disable-next-line no-shadow-restricted-names
declare const globalThis: {
  notionGlobal: ReturnType<typeof notionClientSingleton>
}

const notion = globalThis.notionGlobal ?? notionClientSingleton()

export default notion

if (process.env.NODE_ENV !== 'production') globalThis.notionGlobal = notion
