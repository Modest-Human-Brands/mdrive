import type { AwsClient } from 'aws4fetch'

export default async function (client: AwsClient, bucketUrl: string, objectKey: string, mimeType: string, expiresIn: number = 3600) {
  const url = `${bucketUrl}/${objectKey}?X-Amz-Expires=${expiresIn}`

  const signedRequest = await client.sign(
    new Request(url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
    }),
    { aws: { signQuery: true } }
  )

  return signedRequest.url.toString()
}
