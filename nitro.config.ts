import { defineConfig } from 'nitro'

export default defineConfig({
  compatibilityDate: '2026-04-17',
  serverDir: './server',
  compressPublicAssets: true,
  storage: {
    fs: {
      driver: 'fs',
      base: './static',
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
      mediaUrl: '',
      notionDbId: '',
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
