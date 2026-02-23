import { ApiMiddleware } from 'motia'

export const corsMiddleware: ApiMiddleware = async (_req, _ctx, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // if (req.method === 'OPTIONS') {
  //   return { status: 204, headers: corsHeaders, body: '' }
  // }

  const response = await next()

  return {
    ...response,
    headers: { ...corsHeaders, ...response?.headers },
  }
}
