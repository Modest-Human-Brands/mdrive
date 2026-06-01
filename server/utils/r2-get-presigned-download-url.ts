import { AwsClient } from 'aws4fetch'

export default async function (client: AwsClient, bucketUrl: string, objectKey: string, expiresIn: number = 3600): Promise<string> {
  const rawUrl = `${bucketUrl}/${objectKey}`.replace(/([^:]\/)\/+/g, '$1')
  const url = new URL(rawUrl)

  url.searchParams.set('X-Amz-Expires', expiresIn.toString())

  const signedRequest = await client.sign(
    new Request(url, {
      method: 'GET',
    }),
    { aws: { signQuery: true } }
  )

  return signedRequest.url
}
