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

# Specs

## 0. Health Layer

### `GET /api/health`

**Description:** Verification ping to check system readiness and isolate active compute infrastructure nodes.

**Input:** _(None)_

**Output (JSON):**

```json
{
  "status": "OK",
  "node": "Gigabyte"
}
```

---

## 1. Storage Webhook Layer (Standalone Callbacks)

### `POST /webhook/media/uploads`

**Description:** Non-blocking storage-provider bucket event listener triggered automatically by Cloudflare R2 / AWS S3 when binary streams land in the cloud. Instantly replies with `202` and dispatches processing tasks into the background worker queue.

**Input (JSON - Storage Event Structure):**

```json
{
  "Records": [
    {
      "s3": {
        "bucket": { "name": "production-media-vault" },
        "object": {
          "key": "upload/org_1/prj_8f92a1b/vacation1-batch_abc123-up_7x89dz.jpg",
          "size": 500000
        }
      }
    }
  ]
}
```

**Output (JSON):**

```json
{
  "success": true,
  "message": "Dispatched optimization request"
}
```

### `PUT /webhook/uploads/status`

**Description:** Internal worker state coordination hook used by queue processors to report extraction states, error context, and dynamic asset progress maps directly to the web app's database storage wrapper.

**Input (JSON):**

```json
{
  "batchId": "batch_abc123",
  "projectId": "prj_8f92a1b",
  "uploadId": "up_7x89dz",
  "filename": "vacation1.jpg",
  "status": "processing",
  "progressPercent": 60,
  "mediaId": null,
  "error": null,
  "data": {
    "metadata": {
      "kind": "photo",
      "format": { "formatName": "jpeg", "width": 1920, "height": 1080 }
    }
  }
}
```

**Output (JSON):**

```json
{
  "success": true
}
```

---

## 2. Ingestion Lifecycle Layer (RESTful)

### `POST /api/media/uploads`

**Description:** Initializes a target upload transaction batch. Allocates batch identifiers and generates isolated direct-to-cloud pre-signed storage destination keys for every file declaration.

**Input (JSON):**

```json
{
  "projectId": "prj_8f92a1b",
  "files": [
    { "filename": "vacation1.jpg", "mimeType": "image/jpeg", "sizeBytes": 500000 },
    { "filename": "vacation2.jpg", "mimeType": "image/jpeg", "sizeBytes": 650000 }
  ]
}
```

**Output (JSON):**

```json
{
  "success": true,
  "updatedCount": 2,
  "message": "Successfully initialized upload channels for 2 files.",
  "data": {
    "batchId": "batch_abc123",
    "uploads": [
      {
        "filename": "vacation1.jpg",
        "uploadId": "up_7x89dz",
        "uploadUrl": "https://s3.cloudflare.r2.com/bucket/upload/org_1/prj_8f92a1b/vacation1-batch_abc123-up_7x89dz.jpg?X-Amz-Signature=..."
      },
      {
        "filename": "vacation2.jpg",
        "uploadId": "up_9y22px",
        "uploadUrl": "https://s3.cloudflare.r2.com/bucket/upload/org_1/prj_8f92a1b/vacation2-batch_abc123-up_9y22px.jpg?X-Amz-Signature=..."
      }
    ]
  }
}
```

### `GET /api/media/uploads/:batchId`

**Description:** Highly cacheable read endpoint allowing frontend clients to smoothly poll structural transformation status updates, progress percentages, and errors for an ongoing ingestion batch.

**Input:** _(None, driven by path parameters)_

**Output (JSON):**

```json
{
  "success": true,
  "updatedCount": 3,
  "message": "Successfully fetched status for 3 tracked upload items.",
  "data": {
    "projectId": "prj_8f92a1b",
    "uploads": [
      {
        "uploadId": "up_7x89dz",
        "filename": "IMG_9042.CR2",
        "status": "processing",
        "progressPercent": 40,
        "mediaId": "med_0001",
        "error": null
      },
      {
        "uploadId": "up_9y22px",
        "filename": "vacation.mp4",
        "status": "completed",
        "progressPercent": 100,
        "mediaId": "med_0002",
        "error": null
      },
      {
        "uploadId": "up_broken99",
        "filename": "corrupted_file.png",
        "status": "failed",
        "progressPercent": 100,
        "mediaId": null,
        "error": {
          "code": "EXIF_EXTRACTION_FAILED",
          "message": "File header structure is corrupted."
        }
      }
    ]
  }
}
```

---

## 3. Bulk Operations Gateway (RPC Pattern)

### `POST /api/media/action`

**Description:** Unified mutation routing command-bus. Processes batch data updates across multi-selected item footprints natively using flat schemas.

---

#### Action Scenario: `delete`

**Input (JSON)**

```json
{
  "action": "delete",
  "mediaIds": ["med_0001", "med_0002", "med_0003"]
}
```

**Output (JSON)**

```json
{
  "success": true,
  "updatedCount": 3,
  "message": "3 items moved to trash (30-day retention).",
  "data": null
}
```

---

#### Action Scenario: `approve`

**Input (JSON)**

```json
{
  "action": "approve",
  "mediaIds": ["med_0001"],
  "params": {
    "status": "approved"
  }
}
```

**Output (JSON)**

```json
{
  "success": true,
  "updatedCount": 1,
  "message": "Media approval state updated successfully.",
  "data": {
    "assets": [
      {
        "mediaId": "med_0001",
        "status": "approved",
        "updatedAt": "2026-05-16T10:20:00Z"
      }
    ]
  }
}
```

---

#### Action Scenario: `move`

**Input (JSON)**

```json
{
  "action": "move",
  "mediaIds": ["med_0001", "med_0002"],
  "params": {
    "targetProjectId": "prj_9z21x3"
  }
}
```

**Output (JSON)**

```json
{
  "success": true,
  "updatedCount": 2,
  "message": "2 assets successfully relocated to project prj_9z21x3.",
  "data": null
}
```

---

## 4. Edge-Native Delivery Layer

### `GET /media/:kind/:args/:mediaId`

**Description:** MDrive's unified edge delivery route. It acts as a proxy/cache wrapper around MMedia. For images, it triggers on-the-fly transformations. For videos, it serves the DASH manifest and segment chunks.

- **Input (Path Parameters):**
- `kind` (enum): `image`, `video`, `audio`
- `args` (string): comma-separated transformation modifiers (e.g., `w_1920,q_85,f_webp` or `abr` for video manifests).
- `mediaId` (string): The slug or R2 storage key of the asset.

- **Example Requests:**
- Image: `GET /media/image/w_1920,q_85,f_webp/prj_8f9/IMG_9042.jpg`
- Video (Manifest): `GET /media/video/abr/prj_8f9/Garment_Shoot.mpd`
- Video (Chunk): `GET /media/video/abr/prj_8f9/Garment_Shoot_1_seg_5.m4s`

- **Output:** Binary Stream (e.g., `image/webp`, `application/dash+xml`, or `video/iso.segment`).

## 5. Export & Delivery Layer

### `POST /api/media/downloads`

**Description:** Generates temporary, high-resolution pre-signed delivery paths. It natively accommodates both explicit multi-asset identifier lists and project-wide query requests filtered by validation tab contexts.

**Input (JSON - Specific Multi-Asset Selection):**

```json
{
  "orgId": "red-cat-pictures-3",
  "projectId": "8-rajasthan-e-commerce-shoot",
  "mediaIds": ["photo-0003-0008-0001-001"]
}
```

**Input (JSON - Full Project Selection by Tab Filter):**

```json
{
  "projectId": "prj_8f92a1b",
  "params": {
    "status": "approved"
  }
}
```

**Output (JSON - Unified Format for both variations):**

```json
{
  "updatedCount": 1,
  "expiresIn": 3600,
  "assets": [
    {
      "mediaId": "304ee3b0-289a-819e-be1f-f0fbb07f6cd3",
      "filename": "ecommerce-photo-008-001",
      "downloadUrl": "https://teat.r2.cloudflarestorage.com/development-media-ori..."
    }
  ]
}
```

---

## 6. Client Workspace & Gallery Layer

### `GET /api/projects/:projectId`

**Description:** Initializes the client gallery dashboard with core project metadata alongside a nested matrix detailing storage allocations and approval counts segmentized strictly by file classification type.

**Input:** _(None, driven by path parameter mapping)_

**Output (JSON):**

```json
{
  "id": "prj_8f92a1b",
  "createdAt": "2026-05-10T08:00:00Z",
  "updatedAt": "2026-05-16T10:20:00Z",
  "config": {
    "watermarkEnabled": true
  },
  "mediaSummary": {
    "totals": {
      "count": 112,
      "storageBytes": 2458001023,
      "humanReadableStorage": "2.29 GB"
    },
    "breakdown": {
      "photo": {
        "count": 82,
        "storageBytes": 458001023,
        "approval": {
          "total": 82,
          "approved": 10,
          "notApproved": 2,
          "pending": 70
        }
      },
      "video": {
        "count": 20,
        "storageBytes": 1800000000,
        "approval": {
          "total": 20,
          "approved": 4,
          "notApproved": 0,
          "pending": 16
        }
      },
      "audio": {
        "count": 10,
        "storageBytes": 200000000,
        "approval": {
          "total": 10,
          "approved": 1,
          "notApproved": 0,
          "pending": 9
        }
      }
    }
  }
}
```

### `GET /api/projects/:projectId/media`

**Description:** Returns the asset registry matrix required to cleanly paginate and populate the masonry image boards. Completely decoupled from project stats calculation queries to minimize payload transit times.

**Input (Query Params):** `?status=pending&sort=date_desc&page=1&limit=24`

**Output (JSON):**

```json
{
  "data": [
    {
      "mediaId": "med_0001",
      "url": "https://cdn.mhb.com/prj_8f92a1b/med_0001_thumb.jpg",
      "filename": "IMG_9042.jpg",
      "approvalStatus": "pending",
      "tags": ["outdoor", "garment"]
    }
  ],
  "totalItems": 70
}
```

### `POST /api/projects/:projectId/publish`

**Description:** Deploys finalized review sets to client views and triggers transactional messages (automated emails, WhatsApp integration hooks) to inform client reviewers.

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

## 7. Collaboration Layer

### `POST /api/media/comments`

**Description:** Appends a textual comment or a pinned canvas coordinate to one or multiple media items simultaneously. Can be used to initialize a new comment thread or post a nested reply to an existing conversation.

**Input (JSON):**

```json
{
  "mediaIds": ["med_0001", "med_0002"],
  "parentId": null,
  "text": "Please fix the color grading consistency across these assets.",
  "coordinates": { "x": 45.2, "y": 62.8 }
}
```

_Note: When replying to an existing thread, pass the target comment's ID into `parentId`. Pinned `coordinates` can be set to `null` for nested replies as they naturally inherit the parent context._

**Output (JSON):**

```json
{
  "success": true,
  "updatedCount": 2,
  "message": "Comment successfully appended to 2 media items.",
  "data": {
    "comments": [
      {
        "commentId": "cmt_100abc",
        "mediaId": "med_0001",
        "parentId": null,
        "text": "Please fix the color grading consistency across these assets.",
        "coordinates": { "x": 45.2, "y": 62.8 },
        "author": { "name": "Client Name", "role": "client" },
        "createdAt": "2026-05-16T11:35:00Z"
      },
      {
        "commentId": "cmt_101def",
        "mediaId": "med_0002",
        "parentId": null,
        "text": "Please fix the color grading consistency across these assets.",
        "coordinates": { "x": 45.2, "y": 62.8 },
        "author": { "name": "Client Name", "role": "client" },
        "createdAt": "2026-05-16T11:35:00Z"
      }
    ]
  }
}
```

---

### `POST /api/media/comments/query`

**Description:** Performs a high-performance batch retrieval of all comment trees for a given array of media IDs. Returns top-level pinned entries alongside an integrated, chronological array of nested thread replies.

**Input (JSON):**

```json
{
  "mediaIds": ["med_0001", "med_0002"]
}
```

**Output (JSON):**

```json
{
  "success": true,
  "updatedCount": 2,
  "message": "Successfully fetched comment timelines for 2 media items.",
  "data": {
    "timelines": {
      "med_0001": [
        {
          "commentId": "cmt_99xyz",
          "parentId": null,
          "text": "Make the lighting slightly warmer here.",
          "coordinates": { "x": 45.2, "y": 62.8 },
          "author": { "name": "Client Name", "role": "client" },
          "createdAt": "2026-05-16T11:15:00Z",
          "replies": [
            {
              "commentId": "cmt_102ghi",
              "parentId": "cmt_99xyz",
              "text": "Understood, adjusting color temperatures for the next revision branch.",
              "coordinates": null,
              "author": { "name": "Editor Name", "role": "team" },
              "createdAt": "2026-05-16T11:20:00Z"
            }
          ]
        }
      ],
      "med_0002": [
        {
          "commentId": "cmt_101def",
          "parentId": null,
          "text": "Please fix the color grading consistency across these assets.",
          "coordinates": { "x": 45.2, "y": 62.8 },
          "author": { "name": "Client Name", "role": "client" },
          "createdAt": "2026-05-16T11:35:00Z",
          "replies": []
        }
      ]
    }
  }
}
```

---

### Roadmap

| Order  | Route                                   | Module                 | Complexity Profile                                                                                                                                                             | Status         |
| ------ | --------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| **1**  | `GET /api/health`                       | 0. Health Layer        | **Trivial**: Simple hardcoded static JSON response checking node availability.                                                                                                 | ✅ **Done**    |
| **2**  | `GET /api/media/uploads/:batchId`       | 2. Ingestion Lifecycle | **Low**: A fast, cacheable key-value lookup (via `unstorage` or simple DB query) to return the current polling state.                                                          | ✅ **Done**    |
| **3**  | `PUT /webhook/uploads/status`           | 1. Storage Webhook     | **Low**: A straightforward state mutation endpoint. Receives progress updates and overwrites the active batch array data.                                                      | ✅ **Done**    |
| **4**  | `POST /webhook/media/uploads`           | 1. Storage Webhook     | **Medium-Low**: Needs to safely parse standard S3/R2 event records and dispatch variables securely to your Motia background queue.                                             | ⏳ **Pending** |
| **5**  | `GET /api/projects/:projectId/media`    | 5. Client Workspace    | **Medium**: Standard database querying. Requires implementing pagination (`page`, `limit`) and basic status filtering (`where status = ?`).                                    | ✅ **Done**    |
| **6**  | `POST /api/projects/:projectId/publish` | 5. Client Workspace    | **Medium**: Simple database state update (marking as published), followed by dispatching transactional API calls (Email/WhatsApp integrations).                                | ✅ **Done**    |
| **7**  | `POST /api/media/uploads`               | 2. Ingestion Lifecycle | **Medium-High**: Needs to insert batch tracking rows into the DB _and_ interface with the AWS S3 SDK to generate multiple secure pre-signed upload URLs.                       | ✅ **Done**    |
| **8**  | `POST /api/media/downloads`             | 4. Export & Delivery   | **Medium-High**: Must validate media ownership, optionally filter by status, and map over AWS SDK methods to generate temporary pre-signed download targets.                   | ✅ **Done**    |
| **9**  | `POST /api/media/comments`              | 6. Collaboration Layer | **High**: Requires validating complex JSON (geometric coordinates) and safely resolving `parentId` foreign keys for nested thread creation.                                    | ✅ **Done**    |
| **10** | `POST /api/media/comments/query`        | 6. Collaboration Layer | **High**: Requires querying multiple threads and algorithmically mapping them into a nested dictionary tree (grouping replies under their root parents).                       | ✅ **Done**    |
| **11** | `POST /api/media/action`                | 3. Bulk Operations     | **Very High**: The RPC gateway. Requires setting up a Zod `discriminatedUnion` and writing isolated mutation handlers for bulk delete, approve, and move.                      | ✅ **Done**    |
| **12** | `GET /api/projects/:projectId`          | 5. Client Workspace    | **Very High**: The heaviest read endpoint. Requires complex database aggregations (`SUM` bytes, `COUNT` statuses, `GROUP BY` media kind) to build the nested analytics matrix. | ✅ **Done**    |

Progress = 11/12 = 91%

## License

Published under the [MIT](https://github.com/Modest-Human-Brands/mdrive/blob/main/LICENSE) license.
<br><br>
<a href="https://github.com/Modest-Human-Brands/mdrive/graphs/contributors">
<img src="https://contrib.rocks/image?repo=Modest-Human-Brands/mdrive" />
</a>
