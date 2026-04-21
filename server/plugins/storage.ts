import { definePlugin } from 'nitro'
import { useStorage } from 'nitro/storage'
import { useRuntimeConfig } from 'nitro/runtime-config'
import s3Driver from 'unstorage/drivers/s3'

export default definePlugin(() => {
  const config = useRuntimeConfig().private
  const storage = useStorage()

  // Dynamically pass in credentials from runtime configuration, or other sources
  const cdnDriver = s3Driver({
    accessKeyId: config.cdnR2AccessKeyId,
    secretAccessKey: config.cdnR2SecretAccessKey,
    endpoint: config.cdnR2Endpoint,
    bucket: config.cdnR2Bucket,
    region: config.cdnR2Region,
  })

  // Mount driver
  storage.mount('cdnR2', cdnDriver)

  // Dynamically pass in credentials from runtime configuration, or other sources
  const driveDriver = s3Driver({
    accessKeyId: config.driveR2AccessKeyId,
    secretAccessKey: config.driveR2SecretAccessKey,
    endpoint: config.driveR2Endpoint,
    bucket: config.driveR2Bucket,
    region: config.driveR2Region,
  })

  // Mount driver
  storage.mount('driveR2', driveDriver)
})
