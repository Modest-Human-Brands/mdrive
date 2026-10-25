import { AwsClient } from 'aws4fetch'

/* type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region?: string // for R2: 'auto'
} */

const r2DriveClientSingleton = () => {
  return new AwsClient({
    accessKeyId: process.env.NITRO_PRIVATE_DRIVE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NITRO_PRIVATE_DRIVE_R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: process.env.NITRO_PRIVATE_DRIVE_R2_REGION || 'auto',
  })
}

const globalForR2 = globalThis as unknown as { r2DriveGlobal?: ReturnType<typeof r2DriveClientSingleton> }

const r2Drive = globalForR2.r2DriveGlobal ?? r2DriveClientSingleton()

export default r2Drive

if (process.env.NODE_ENV !== 'production') globalForR2.r2DriveGlobal = r2Drive
