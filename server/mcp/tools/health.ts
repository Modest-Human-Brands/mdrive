import { defineMcpTool } from 'nitro-mcp-toolkit'

export default defineMcpTool({
  name: 'health',
  description: 'Get health, version, buildtime, and node',
  handler: () => {
    const node = process.env.HOSTNAME || 'unknown-node'

    return {
      status: 'OK',
      version: process.env.NITRO_APP_VERSION!,
      buildTime: process.env.NITRO_APP_BUILD_TIME!,
      node,
    }
  },
})
