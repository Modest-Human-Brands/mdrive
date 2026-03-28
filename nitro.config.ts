import { defineConfig } from 'nitro'

export default defineConfig({
  compatibilityDate: 'latest',
  serverDir: './',
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
  runtimeConfig: {
    app: {
      version: '',
      buildTime: '',
    },
    private: {
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
