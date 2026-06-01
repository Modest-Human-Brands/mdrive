import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  compressPublicAssets: true,
  // imports: {},
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    '*/1 * * * *': ['sync:resource'],
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
    private: {
      notionDbId: '',
      mediaUrl: '',
      mconnectUrl: '',
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
