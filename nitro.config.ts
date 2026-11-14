import { fileURLToPath } from 'node:url'
import { defineConfig } from 'nitro'
import mcp from 'nitro-mcp-toolkit/module'

export default defineConfig({
  modules: [mcp()],
  serverDir: './server',
  alias: {
    '~': fileURLToPath(new URL('.', import.meta.url)),
  },
  compressPublicAssets: true,
  // imports: {},
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    '10,25,40,55 * * * *': ['sync:resource'],
  },
  storage: {
    fs: {
      driver: 'fs',
      base: './static',
    },
    data: {
      driver: 'fs',
      base: './.data',
    },
    /*  r2: {
       driver: 's3',
       accessKeyId: '',
       secretAccessKey: '',
       endpoint: '',
       bucket: '',
       region: '',
     }, */
  },
  routeRules: {
    '/media/**': { cors: true },
  },
  runtimeConfig: {
    app: {
      version: '',
      buildTime: '',
    },
    public: {
      mediaUrl: process.env.NITRO_MDRIVE_PUBLIC_MEDIA_URL || '',
    },
    private: {
      notionDbId: process.env.NOTION_DB_ID || '',
      mmediaUrl: process.env.NITRO_MDRIVE_PRIVATE_MMEDIA_URL || '',
      mmediaApiKey: process.env.NITRO_MDRIVE_PRIVATE_MMEDIA_API_KEY || '',
      mconnectUrl: process.env.NITRO_MDRIVE_PRIVATE_MCONNECT_URL || '',
      mediaRedirectUrl: process.env.NITRO_MDRIVE_PRIVATE_MEDIA_REDIRECT_URL || '',
      serverValidationKey: process.env.NITRO_MDRIVE_PRIVATE_SERVER_VALIDATION_KEY || '',
      cdnR2AccessKeyId: process.env.NITRO_MDRIVE_PRIVATE_CDN_R2_ACCESS_KEY_ID || '',
      cdnR2SecretAccessKey: process.env.NITRO_MDRIVE_PRIVATE_CDN_R2_SECRET_ACCESS_KEY || '',
      cdnR2Endpoint: process.env.NITRO_MDRIVE_PRIVATE_CDN_R2_ENDPOINT || '',
      cdnR2Bucket: process.env.NITRO_MDRIVE_PRIVATE_CDN_R2_BUCKET || '',
      cdnR2Region: process.env.NITRO_MDRIVE_PRIVATE_CDN_R2_REGION || '',
      cdnR2PublicUrl: '',
      driveApiToken: '',
      drivePublicUrl: '',
      driveR2AccessKeyId: process.env.NITRO_MDRIVE_PRIVATE_DRIVE_R2_ACCESS_KEY_ID || '',
      driveR2SecretAccessKey: process.env.NITRO_MDRIVE_PRIVATE_DRIVE_R2_SECRET_ACCESS_KEY || '',
      driveR2Endpoint: process.env.NITRO_MDRIVE_PRIVATE_DRIVE_R2_ENDPOINT || '',
      driveR2Bucket: process.env.NITRO_MDRIVE_PRIVATE_DRIVE_R2_BUCKET || '',
      driveR2Region: process.env.NITRO_MDRIVE_PRIVATE_DRIVE_R2_REGION || '',
      driveR2PublicUrl: '',
    },
  },
})
