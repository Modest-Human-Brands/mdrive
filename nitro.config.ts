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
      mediaUrl: '',
    },
    private: {
      notionDbId: '',
      mconnectUrl: '',
      mediaRedirectUrl: '',
      serverValidationKey: '',
      cdnR2AccessKeyId: '',
      cdnR2SecretAccessKey: '',
      cdnR2Endpoint: '',
      cdnR2Bucket: '',
      cdnR2Region: '',
      cdnR2PublicUrl: '',
      driveApiToken: '',
      drivePublicUrl: '',
      driveR2AccessKeyId: '',
      driveR2SecretAccessKey: '',
      driveR2Endpoint: '',
      driveR2Bucket: '',
      driveR2Region: '',
      driveR2PublicUrl: '',
    },
  },
})
