import { AwsClient } from 'aws4fetch'

/* type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region?: string // for R2: 'auto'
} */

const r2CdnClientSingleton = () => {
  return new AwsClient({
    accessKeyId: process.env.NITRO_PRIVATE_CDN_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NITRO_PRIVATE_CDN_R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: process.env.NITRO_PRIVATE_CDN_R2_REGION || 'auto',
  })
}

const globalForR2 = globalThis as unknown as { r2CdnGlobal?: ReturnType<typeof r2CdnClientSingleton> }

const r2Cdn = globalForR2.r2CdnGlobal ?? r2CdnClientSingleton()

export default r2Cdn

if (process.env.NODE_ENV !== 'production') globalForR2.r2CdnGlobal = r2Cdn
