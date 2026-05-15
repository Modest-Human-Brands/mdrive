<p align="center">
  <img src="./public/logo.png" alt="Logo" width="65" />
</p>

# MDrive

<p align="center">
  <a href="https://shirsendu-bairagi.betteruptime.com">
    <img src="https://uptime.betterstack.com/status-badges/v3/monitor/10aqw.svg" alt="Uptime Status">
  </a>
</p>

![Landing](public/previews/landing.webp)

> A role-based media asset management service for storing, organizing, and distributing media via global CDN, with granular access control and signed URL delivery

## Specs

## 0. Health

### `GET /api/health`

Check Health

**Input: (None, driven by URL parameter)**

**Output**

```json
{
  "status": "OK",
  "node": "Gigabyte"
}
```

## 1. Upload & Ingestion Layer

### `POST /api/uploads`

Initializes a multipart upload and generates a secure S3 pre-signed URL for direct-to-cloud uploading.

**Input (JSON):**

```json
{
  "projectId": "",
  "files": [
    { "filename": "vacation1.jpg", "mimeType": "image/jpeg", "sizeBytes": 500000 },
    { "filename": "vacation2.jpg", "mimeType": "image/jpeg", "sizeBytes": 650000 }
  ]
}
```

**Output (JSON):**

```json
{
  "batchId": "batch_abc123",
  "uploads": [
    {
      "filename": "vacation1.jpg",
      "uploadId": "up_7x89dz",
      "uploadUrl": "https://s3.cloudflare.r2.com/..."
    },
    {
      "filename": "vacation2.jpg",
      "uploadId": "up_9y22px",
      "uploadUrl": "https://s3.cloudflare.r2.com/..."
    }
  ]
}
```

### `POST webhook/uploads/status`

**Input (JSON):**

```json
{}
```

**Output (JSON):**

```json
{ "success": true }
```

### `GET /api/uploads/status?batchId=up_7x89dz`

The client can poll this endpoint (or connect via WebSockets/Server-Sent Events) using the

**Input: (None, driven by URL parameter)**

**Output (JSON):**

```json
{
  "projectId": "",
  "uploads": [
    {
      "uploadId": "up_7x89dz",
      "filename": "IMG_9042.CR2",
      "status": "processing",
      "progressPercent": 40,
      "mediaId": "med_11x8a",
      "error": null
    },
    {
      "uploadId": "up_9y22px",
      "filename": "vacation.mp4",
      "status": "completed",
      "progressPercent": 100,
      "mediaId": "med_12y9b",
      "error": null
    },
    {
      "uploadId": "up_broken99",
      "filename": "corrupted_file.png",
      "status": "failed",
      "progressPercent": 0,
      "mediaId": null,
      "error": {
        "code": "EXIF_EXTRACTION_FAILED",
        "message": "File header is corrupted."
      }
    }
  ]
}
```

## 2. Organization & Bulk Management Layer

<!--

### `GET /api/projects/:id/media`

Fetches the masonry grid of media assets for a project. Supports filtering and pagination.

**Input (Query Params):** `?status=delivered&sort=date_desc&page=1`

**Output (JSON):**

```json
{
  "data": [
    {
      "mediaId": "med_11x8a",
      "url": "https://cdn.mhb.com/prj_8f92a1b/med_11x8a_thumb.jpg",
      "filename": "IMG_9042.jpg",
      "approvalStatus": "pending",
      "tags": ["outdoor", "garment"]
    }
  ],
  "totalItems": 112
}
``` -->

### `POST /api/media/action`

Executes bulk actions (soft delete, move, update tags) across multiple selected items.

**Input (JSON):**

```json
{
  "mediaIds": ["med_11x8a", "med_11x8b", "med_11x8c"],
  "action": "soft_delete"
}
```

**Output (JSON):**

```json
{
  "success": true,
  "updatedCount": 3,
  "message": "3 items moved to trash (30-day retention)."
}
```

## 3. Client Workflow & Approval Layer

### `GET /api/project/:projectId/stats`

Fetches the dynamic approval tab numbers for the client gallery view.

**Input:** _(None, driven by URL parameter)_

**Output (JSON):**

```json
{
  "total": 112,
  "approved": 15,
  "notApproved": 2,
  "pending": 95
}
```

### `PATCH /api/media/:id/approve`

**Description:** Client approves or rejects an asset. Triggers audit log and webhook to MCoordinate.
**Input (JSON):**

```json
{
  "status": "approved"
}
```

**Output (JSON):**

```json
{
  "mediaId": "med_11x8a",
  "status": "approved",
  "updatedAt": "2026-05-14T15:10:00Z"
}
```

### `POST /api/projects/:id/publish`

**Description:** Team clicks "Publish". Triggers MConnect to dispatch emails/WhatsApp messages to the client.
**Input (JSON):**

```json
{
  "notifyChannels": ["email", "whatsapp"],
  "customMessage": "Hey! The Garment Shoot is ready for your review."
}
```

**Output (JSON):**

```json
{
  "success": true,
  "dispatchedCount": 2,
  "message": "Client notified successfully."
}
```

---

## 4. Collaboration & Commenting Layer

### `POST /api/media/:id/comments`

**Description:** Adds a threaded comment or drops a pin on the media canvas.
**Input (JSON):**

```json
{
  "text": "Make the lighting slightly warmer here.",
  "coordinates": { "x": 45.2, "y": 62.8 },
  "parentId": null
}
```

**Output (JSON):**

```json
{
  "commentId": "cmt_99xyz",
  "text": "Make the lighting slightly warmer here.",
  "coordinates": { "x": 45.2, "y": 62.8 },
  "author": { "name": "Client Name", "role": "client" },
  "createdAt": "2026-05-14T15:15:00Z"
}
```

---

## 5. Export & Delivery Layer (Parallel Download)

### `GET /api/media/:id/download`

**Description:** Generates a secure, temporary, high-resolution download link for a single asset.
**Input (Query Params):** `?version=v2`
**Output (JSON):**

```json
{
  "downloadUrl": "https://s3.cloudflare.r2.com/bucket/final/IMG_9042_v2.jpg?X-Amz-Signature=...",
  "expiresIn": 300
}
```

### `GET /api/projects/:id/bulk-download-urls`

**Description:** Replaces ZIP generation. The backend instantly returns an array of pre-signed URLs for all approved media. The frontend client (Vue/Nuxt) takes this array and initiates parallel, direct-to-disk downloads using the browser's native download API or a Service Worker. Zero backend compute required.
**Input (Query Params):** `?status=approved`
**Output (JSON):**

```json
{
  "count": 15,
  "expiresIn": 3600,
  "assets": [
    {
      "mediaId": "med_11x8a",
      "filename": "Garment_Shoot_001.jpg",
      "downloadUrl": "https://s3.cloudflare.r2.com/bucket/final/Garment_Shoot_001.jpg?X-Amz-Signature=..."
    },
    {
      "mediaId": "med_11x8b",
      "filename": "Garment_Shoot_002.jpg",
      "downloadUrl": "https://s3.cloudflare.r2.com/bucket/final/Garment_Shoot_002.jpg?X-Amz-Signature=..."
    }
  ]
}
```

## License

Published under the [MIT](https://github.com/Modest-Human-Brands/mdrive/blob/main/LICENSE) license.
<br><br>
<a href="https://github.com/Modest-Human-Brands/mdrive/graphs/contributors">
<img src="https://contrib.rocks/image?repo=Modest-Human-Brands/mdrive" />
</a>
