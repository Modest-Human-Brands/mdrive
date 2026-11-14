# TODO

- [x] Nitro server application setup
- [x] Service health diagnostics endpoint (`GET /api/health`) and MCP health tool
- [x] Project workspace listing and details (`GET /api/projects`, `GET /api/projects/:projectId`)
- [x] Project media asset query with status and category filters (`GET /api/projects/:projectId/media`)
- [x] Project publishing status transition endpoint (`POST /api/projects/:projectId/publish`)
- [x] Direct-to-storage batch presigned upload session initiator (`POST /api/media/uploads`)
- [x] Upload batch processing state polling (`GET /api/media/uploads/:batchId`)
- [x] Storage webhook notification receiver (`PUT /webhook/uploads/status`)
- [x] Bulk RPC media actions: delete, approve, move (`POST /api/media/action`)
- [x] Pre-signed media download link generator (`POST /api/media/downloads`)
- [x] Canvas review comments and spatial coordinate pinning (`POST /api/media/comments`)
- [x] Spatial comment thread query by media ID (`POST /api/media/comments/query`)
- [x] Edge media transformation and delivery proxy (`GET /media/:kind/**`)
- [x] Notion CRM synchronization for asset metadata and approval statuses
- [ ] Remove residual workspace artifacts (`temp/motia`, `temp/nitro`)
- [ ] Implement background distributed resource sync task (`sync:resource`)
- [ ] Video transcoding queue trigger integration
