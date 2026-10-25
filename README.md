<div align="center">

<a href="https://modesthumanbrands.com">
  <img src="https://modesthumanbrands.com/logo.svg" alt="Modest Human Brands Logo" width="64" height="64" />
</a>

# MDrive

**Role-based media asset management backend service built on UnJS Nitro.**  
Engineered for storing, organizing, and distributing media via global CDN with granular access control, Notion-backed persistence, and signed Cloudflare R2 delivery.

[![Version](https://img.shields.io/github/v/release/Modest-Human-Brands/mdrive?color=blue&label=version)](https://github.com/Modest-Human-Brands/mdrive/releases)
[![Nitro CI](https://github.com/Modest-Human-Brands/mdrive/actions/workflows/integrate.yml/badge.svg)](https://github.com/Modest-Human-Brands/mdrive/actions/workflows/integrate.yml)
[![Container Registry](https://img.shields.io/badge/ghcr.io-modest--human--brands%2Fmdrive-blue?logo=docker)](https://github.com/Modest-Human-Brands/mdrive/pkgs/container/mdrive)
[![Uptime Status](https://uptime.betterstack.com/status-badges/v3/monitor/10aqw.svg)](https://shirsendu-bairagi.betteruptime.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/Modest-Human-Brands/mdrive/blob/main/LICENSE)

</div>

---

### Features

- ⚡ **Nitro-Powered Microservice:** High-performance, edge-ready backend built with UnJS Nitro v3, running seamlessly on Node.js and Bun.
- 🗄️ **Notion Database Sync Engine:** Resilient, periodic two-way synchronization (`sync:resource`) with built-in rate-limiting (`p-throttle`) and exponential backoff (`p-retry`).
- 🔐 **Pre-Signed Cloudflare R2 Pipeline:** Direct-to-storage authenticated uploads and temporary signed download links using lightweight `aws4fetch` without heavy SDKs.
- 📐 **Dynamic Edge Transformations:** Real-time IPX image modifier processing, automated format negotiation (AVIF, WebP, JPEG), and MPEG-DASH manifest generation.
- 💬 **Frame-Accurate Collaboration:** Coordinate-based spatial commenting system with threaded discussions and multi-asset assignment.
- 🤖 **Native Model Context Protocol (MCP):** Built-in MCP server integration exposing system health and diagnostics directly to AI agent workflows.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │              Client App               │
                      └───────┬───────────────────────▲───────┘
                              │                       │
                Upload / Download Requests     Direct Signed S3/R2 I/O
                              │                       │
                              ▼                       │
               ┌───────────────────────────────┐      │
               │         MDrive Server         │      │
               │      (UnJS Nitro Backend)     │      │
               └───┬──────────────┬─────────┬──┘      │
                   │              │         │         │
    Task Sync (Cron)    KV Cache  │         └─────────┼──────────┐
                   │              │                   │          │
                   ▼              ▼                   ▼          ▼
            ┌────────────┐  ┌───────────┐      ┌─────────────────────────┐
            │   Notion   │  │ unstorage │      │      Cloudflare R2      │
            │  Database  │  │ (FS / S3) │      │  (Vault / CDN Storage)  │
            └────────────┘  └───────────┘      └─────────────────────────┘
```

---

## Quickstart & Service Run

MDrive is an HTTP microservice application. It is executed directly via Bun or containerized with Docker.

### Requirements

- **Bun:** `^1.2.9` (Project lockfile: `bun@1.3.14`) or **Node.js:** `^22.11.0 || ^24.14.0`
- **Docker:** Optional (for container deployments)

### Running Locally

```bash
# 1. Clone repository
git clone https://github.com/Modest-Human-Brands/mdrive.git
cd mdrive

# 2. Install dependencies
bun install --frozen-lockfile

# 3. Configure environment
cp .env.example .env
# Fill in required variables in .env

# 4. Start development server
bun run dev

# 5. Build and run production server
bun run build
bun run start
```

### Running with Docker

```bash
# Build image
docker build --build-arg VERSION=0.9.1 --build-arg BUILD_TIME=now -t mdrive:0.9.1 .

# Run container
docker run -d --name mdrive -p 3000:3000 --env-file .env.prod mdrive:0.9.1
```

Official pre-built container images are published to GitHub Container Registry:

```bash
docker pull ghcr.io/modest-human-brands/mdrive:latest
```

---

## Configuration Reference

Configuration is managed via environment variables defined in `.env`:

| Variable                                   | Type          | Required | Description                                                                                           |
| :----------------------------------------- | :------------ | :------: | :---------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `string`      |    No    | Runtime environment (`development` or `production`). Default: `development`.                          |
| `NOTION_API_KEY`                           | `string`      | **Yes**  | Notion integration secret key for querying and updating records.                                      |
| `NITRO_PRIVATE_NOTION_DB_ID`               | `JSON string` | **Yes**  | JSON mapping of database IDs: `{"organization":"...","project":"...","media":"...","contact":"..."}`. |
| `NITRO_PUBLIC_SITE_URL`                    | `string`      |    No    | Base public URL of the application.                                                                   |
| `NITRO_SESSION_PASSWORD`                   | `string`      |    No    | Encryption secret for Nitro session handling.                                                         |
| `NITRO_PRIVATE_SERVER_VALIDATION_KEY`      | `string`      | **Yes**  | Shared API key. Clients send it in the `x-api-key` header.                                            |
| `NITRO_PRIVATE_MEDIA_REDIRECT_URL`         | `string`      | **Yes**  | Base URL that `GET /media/:kind/**` redirects (302) to, e.g. `https://cdn.example.com`.               |
| `NITRO_PRIVATE_STEGANOGRAPHY_KEY`          | `string`      |    No    | Encryption key for invisible image watermarking.                                                      |
| `NITRO_PRIVATE_DRIVE_R2_ENDPOINT`          | `string`      | **Yes**  | S3 API endpoint for Cloudflare R2 primary storage.                                                    |
| `NITRO_PRIVATE_DRIVE_R2_BUCKET`            | `string`      | **Yes**  | Cloudflare R2 bucket name for media storage.                                                          |
| `NITRO_PRIVATE_DRIVE_R2_ACCESS_KEY_ID`     | `string`      | **Yes**  | R2 access key ID with read/write permissions.                                                         |
| `NITRO_PRIVATE_DRIVE_R2_SECRET_ACCESS_KEY` | `string`      | **Yes**  | R2 secret access key.                                                                                 |
| `NITRO_PRIVATE_DRIVE_R2_REGION`            | `string`      |    No    | R2 bucket region (default: `auto`).                                                                   |
| `NITRO_PRIVATE_DRIVE_R2_PUBLIC_URL`        | `string`      |    No    | Public CDN or vanity domain URL for direct media access.                                              |
| `NITRO_PRIVATE_CDN_R2_ENDPOINT`            | `string`      |    No    | S3 API endpoint for secondary CDN edge cache bucket.                                                  |
| `NITRO_PRIVATE_CDN_R2_BUCKET`              | `string`      |    No    | S3 bucket name for CDN cache assets.                                                                  |
| `NITRO_PRIVATE_CDN_R2_ACCESS_KEY_ID`       | `string`      |    No    | Access key ID for CDN bucket.                                                                         |
| `NITRO_PRIVATE_CDN_R2_SECRET_ACCESS_KEY`   | `string`      |    No    | Secret access key for CDN bucket.                                                                     |
| `NITRO_PRIVATE_CDN_R2_REGION`              | `string`      |    No    | Region for CDN bucket.                                                                                |
| `NITRO_PRIVATE_CDN_R2_PUBLIC_URL`          | `string`      |    No    | Public URL for CDN cache distribution.                                                                |
| `CONCURRENCY_LIMIT`                        | `number`      |    No    | Limit for concurrent batch operations.                                                                |

---

## API Specifications

All `/api/**` and `/webhook/**` endpoints (except `GET /api/health`) require an `x-api-key` header matching `NITRO_PRIVATE_SERVER_VALIDATION_KEY`: missing key returns `401`, wrong key `403`, and an unset server key `500`. `/media/**` is public.

All endpoints return JSON responses unless streaming media content. Route parameters and request bodies are strictly validated with [Zod](https://zod.dev).

```
API Endpoints Index
├── 1. System & MCP
│   ├── GET  /api/health
│   ├── MCP  health (Tool)
│   └── TASK sync:resource (Cron)
├── 2. Projects & Workspaces
│   ├── GET  /api/projects
│   ├── GET  /api/projects/:projectId
│   ├── GET  /api/projects/:projectId/media
│   └── POST /api/projects/:projectId/publish
├── 3. Ingestion & Pre-Signed Uploads
│   ├── POST /api/media/uploads
│   ├── GET  /api/media/uploads/:batchId
│   └── PUT  /webhook/uploads/status
├── 4. Bulk Operations (RPC Gateway)
│   └── POST /api/media/action (delete | approve | move)
├── 5. Pre-Signed Downloads & Delivery
│   └── POST /api/media/downloads
├── 6. Collaboration & Canvas Comments
│   ├── POST /api/media/comments
│   └── POST /api/media/comments/query
└── 7. Edge Delivery & Media Transformation
    └── GET  /media/:kind/**
```

---

### 1. System & MCP Layer

#### `GET /api/health`

Verifies server health, version, build timestamp, and executing container/host node.

- **Request:** `GET /api/health`
- **Response `200 OK`:**
  ```json
  {
    "status": "OK",
    "version": "0.9.1",
    "buildTime": "2026-10-16T06:00:00.000Z",
    "node": "mdrive-worker-01"
  }
  ```

#### MCP Tool: `health`

Exposed for MCP-compatible AI agents via `nitro-mcp-toolkit`:

- **Tool Name:** `health`
- **Description:** `Get health, version, buildtime, and node`
- **Output:** Returns server status, version, build time, and host node.

#### Scheduled Task: `sync:resource`

- **Schedule:** `10,25,40,55 * * * *` (Runs every 15 minutes at minutes 10, 25, 40, and 55).
- **Behavior:** Queries Notion databases for `organization`, `contact`, `project`, and `media` using `@notionhq/client`. Requests are rate-limited with `p-throttle` (2 requests/second) and retried with `p-retry` (up to 3 retries on HTTP 429 rate limits). Cached into `unstorage` under `data:resource:*`.

---

### 2. Projects & Workspaces

#### `GET /api/projects`

Lists paginated projects with associated client details, media asset counts, and image previews.

- **Query Parameters:**

  | Parameter | Type     | Default | Description                                                                              |
  | :-------- | :------- | :-----: | :--------------------------------------------------------------------------------------- |
  | `status`  | `string` | _None_  | Optional project status filter (e.g. `Plan`, `Quotation`, `Shoot`, `Edit`, `Delivered`). |
  | `search`  | `string` | _None_  | Case-insensitive substring search matching project title or client name.                 |
  | `page`    | `number` |   `1`   | Page number (minimum `1`).                                                               |
  | `limit`   | `number` |  `100`  | Number of items per page (range: `1` – `100`).                                           |

- **Request:**

  ```bash
  curl -X GET "https://drive.example.com/api/projects?status=Shoot&page=1&limit=10"
  ```

- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "c01826aa-3701-4475-8ec9-7f31cce1129b",
        "slug": "8-rajasthan-e-commerce-shoot",
        "title": "Rajasthan E-Commerce Shoot",
        "date": "2026-05-10T08:00:00.000Z",
        "status": "Shoot",
        "client": {
          "name": "Acme Studios",
          "avatar": "https://example.com/avatar.jpg"
        },
        "mediaCount": {
          "photo": 82,
          "video": 20
        },
        "previewImages": ["photo-0003-0008-0001-001", "photo-0003-0008-0002-001"]
      }
    ],
    "totalItems": 1
  }
  ```

---

#### `GET /api/projects/:projectId`

Returns project metadata, watermark configuration, and an aggregated storage and approval breakdown matrix segmentized by media classification (`photo`, `video`, `audio`).

- **Path Parameters:**
  - `projectId` (`string`): Notion project page UUID (dashes optional).

- **Request:**

  ```bash
  curl -X GET "https://drive.example.com/api/projects/304ee3b0-289a-81f5-9261-c410967f5a36"
  ```

- **Response `200 OK`:**
  ```json
  {
    "id": "304ee3b0-289a-81f5-9261-c410967f5a36",
    "orgId": "org_red-cat-pictures-1",
    "name": "Rajasthan E-Commerce Shoot",
    "status": "shoot",
    "createdAt": "2026-05-10T08:00:00.000Z",
    "updatedAt": "2026-05-16T10:20:00.000Z",
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
          "humanReadableStorage": "436.78 MB",
          "approval": {
            "total": 82,
            "plan": 0,
            "pending": 70,
            "approved": 10,
            "rejected": 2,
            "release": 0,
            "archive": 0
          }
        },
        "video": {
          "count": 20,
          "storageBytes": 1800000000,
          "humanReadableStorage": "1.68 GB",
          "approval": {
            "total": 20,
            "plan": 0,
            "pending": 16,
            "approved": 4,
            "rejected": 0,
            "release": 0,
            "archive": 0
          }
        },
        "audio": {
          "count": 10,
          "storageBytes": 200000000,
          "humanReadableStorage": "190.73 MB",
          "approval": {
            "total": 10,
            "plan": 0,
            "pending": 9,
            "approved": 1,
            "rejected": 0,
            "release": 0,
            "archive": 0
          }
        }
      }
    }
  }
  ```

---

#### `GET /api/projects/:projectId/media`

Returns paginated media assets (`id` is the Notion media page UUID) belonging to the given project (`projectId` is the Notion project page UUID), formatted for gallery and grid views with thumbnail URLs and technical metadata.

- **Query Parameters:**

  | Parameter | Type                                                                        |    Default    | Description                          |
  | :-------- | :-------------------------------------------------------------------------- | :-----------: | :----------------------------------- |
  | `status`  | `'plan' \| 'pending' \| 'approved' \| 'rejected' \| 'release' \| 'archive'` |    _None_     | Filters assets by approval status.   |
  | `sort`    | `'date_desc' \| 'date_asc'`                                                 | `'date_desc'` | Sort order by creation timestamp.    |
  | `page`    | `number`                                                                    |      `1`      | Page number (minimum `1`).           |
  | `limit`   | `number`                                                                    |     `24`      | Items per page (range: `1` – `100`). |

- **Request:**

  ```bash
  curl -X GET "https://drive.example.com/api/projects/304ee3b0-289a-81f5-9261-c410967f5a36/media?status=approved&page=1&limit=24"
  ```

- **Response `200 OK`:**
  ```json
  {
    "data": [
      {
        "id": "304ee3b0-289a-817e-8f5a-ce45b13ffeaf",
        "url": "https://media.example.com/media/image/s_810x1080/photo-0003-0008-0001-001",
        "filename": "Desert_Look_01.jpg",
        "status": "approved",
        "type": "photo",
        "metadata": {
          "resolution": "1080p",
          "aspectRatio": "3:2"
        }
      }
    ],
    "totalItems": 1
  }
  ```

---

#### `POST /api/projects/:projectId/publish`

Marks a project review set as finalized in the database by updating the Notion project status to `Delivered`. `projectId` is the Notion project page UUID.

- **Request Body:**

  | Field    | Type      | Required | Description                                                             |
  | :------- | :-------- | :------: | :---------------------------------------------------------------------- |
  | `notify` | `boolean` | **Yes**  | Flag indicating whether reviewer notification workflows should execute. |

- **Request:**

  ```bash
  curl -X POST "https://drive.example.com/api/projects/304ee3b0-289a-81f5-9261-c410967f5a36/publish" \
    -H "Content-Type: application/json" \
    -d '{ "notify": true }'
  ```

- **Response `200 OK`:**
  ```json
  {
    "notify": true
  }
  ```

---

### 3. Ingestion & Pre-Signed Uploads

#### `POST /api/media/uploads`

Initializes an upload batch transaction. The organization slug is sent in the `x-org-id` header. Automatically generates canonical asset identifiers adhering to `{prefix}-{orgIndex}-{projectIndex}-{mediaIndex}-{versionIndex}.{ext}` and issues direct-to-cloud pre-signed Cloudflare R2 upload URLs.

- **Request Body:**

  | Field               | Type     | Required | Description                                          |
  | :------------------ | :------- | :------: | :--------------------------------------------------- |
  | `projectId`         | `string` | **Yes**  | Target Notion project page UUID.                     |
  | `files`             | `array`  | **Yes**  | Array of file declarations to upload.                |
  | `files[].filename`  | `string` | **Yes**  | Original filename with extension (e.g. `look1.jpg`). |
  | `files[].mimeType`  | `string` | **Yes**  | Valid MIME type (e.g. `image/jpeg`, `video/mp4`).    |
  | `files[].sizeBytes` | `number` | **Yes**  | File byte length.                                    |

- **Request:**

  ```bash
  curl -X POST "https://drive.example.com/api/media/uploads" \
    -H "Content-Type: application/json" \
    -H "x-org-id: red-cat-pictures-3" \
    -d '{
      "projectId": "304ee3b0-289a-81f5-9261-c410967f5a36",
      "files": [
        { "filename": "look1.jpg", "mimeType": "image/jpeg", "sizeBytes": 5242880 },
        { "filename": "b-roll.mp4", "mimeType": "video/mp4", "sizeBytes": 104857600 }
      ]
    }'
  ```

- **Response `200 OK`:**
  ```json
  {
    "batchId": "batch_a1b2c3d4",
    "uploads": [
      {
        "filename": "photo-0003-0008-0001-001.jpg",
        "uploadId": "up_9x8y7z6w",
        "uploadUrl": "https://storage.r2.cloudflarestorage.com/media-vault/upload/red-cat-pictures-3/304ee3b08a1b81f59261c410967f5a36/photo-0003-0008-0001-001.jpg?X-Amz-Signature=..."
      },
      {
        "filename": "video-0003-0008-0002-001.mp4",
        "uploadId": "up_5v4u3t2s",
        "uploadUrl": "https://storage.r2.cloudflarestorage.com/media-vault/upload/red-cat-pictures-3/304ee3b08a1b81f59261c410967f5a36/video-0003-0008-0002-001.mp4?X-Amz-Signature=..."
      }
    ]
  }
  ```

---

#### `GET /api/media/uploads/:batchId`

Retrieves status, progress percentage, error states, and generated Notion media IDs for all items in an ongoing upload batch. Returns `404` for an unknown batch.

- **Path Parameters:**
  - `batchId` (`string`): Batch identifier returned by `POST /api/media/uploads`.

- **Response `200 OK`:**
  ```json
  {
    "projectId": "304ee3b0-289a-81f5-9261-c410967f5a36",
    "uploads": [
      {
        "uploadId": "up_9x8y7z6w",
        "filename": "photo-0003-0008-0001-001.jpg",
        "status": "completed",
        "progressPercent": 100,
        "mediaId": "med_12345678",
        "error": null
      },
      {
        "uploadId": "up_5v4u3t2s",
        "filename": "video-0003-0008-0002-001.mp4",
        "status": "processing",
        "progressPercent": 65,
        "mediaId": null,
        "error": null
      }
    ]
  }
  ```

---

#### `PUT /webhook/uploads/status`

Internal callback endpoint used by background transcoding and ingestion workers to update batch progress and persist extracted technical metadata (aspect ratio, resolution) into Notion.

- **Request Body:**

  | Field             | Type                                                   | Required | Description                                                      |
  | :---------------- | :----------------------------------------------------- | :------: | :--------------------------------------------------------------- |
  | `batchId`         | `string`                                               |    No    | Associated upload batch ID.                                      |
  | `uploadId`        | `string`                                               |    No    | Specific item upload ID within the batch.                        |
  | `filename`        | `string`                                               | **Yes**  | Canonical asset filename containing encoded indices.             |
  | `status`          | `'pending' \| 'processing' \| 'completed' \| 'failed'` | **Yes**  | Ingestion status.                                                |
  | `progressPercent` | `number`                                               | **Yes**  | Processing completion percentage (0 - 100).                      |
  | `mediaId`         | `string \| null`                                       | **Yes**  | Existing Notion media record ID, or `null` to create a new page. |
  | `error`           | `string \| null`                                       | **Yes**  | Error message string if processing failed, or `null`.            |
  | `data`            | `object \| null`                                       |    No    | Extracted file metadata object: `{ metadata: { kind: "photo"     | "video", format: { width, height } } }`. |

- **Response `200 OK`:**
  ```json
  {
    "success": true
  }
  ```

---

### 4. Bulk Operations (RPC Gateway)

#### `POST /api/media/action`

Unified mutation command bus accepting a discriminated union on `action`. `mediaIds` are Notion media page UUIDs. Dispatches atomic operations across multi-selected asset footprints.

---

#### Action: `delete`

Performs soft deletion by archiving target pages in Notion (retained for 30 days).

- **Request Body:**

  ```json
  {
    "action": "delete",
    "mediaIds": ["304ee3b0-289a-817e-8f5a-ce45b13ffeaf", "304ee3b0-289a-81a4-b1c2-d3e4f5a6b7c8"]
  }
  ```

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "updatedCount": 2,
    "message": "2 items moved to trash (30-day retention).",
    "data": null
  }
  ```

---

#### Action: `approve`

Updates approval state across selected media items (stored in the Notion `Status` as `Approved`, `Rejected` or `Pending`).

- **Request Body:**

  ```json
  {
    "action": "approve",
    "mediaIds": ["304ee3b0-289a-817e-8f5a-ce45b13ffeaf"],
    "params": {
      "status": "approved"
    }
  }
  ```

  _Allowed `params.status` values:_ `'approved'`, `'rejected'`, `'pending'`.

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "updatedCount": 1,
    "message": "Media approval state updated successfully.",
    "data": {
      "assets": [
        {
          "mediaId": "304ee3b0-289a-817e-8f5a-ce45b13ffeaf",
          "status": "approved",
          "updatedAt": "2026-10-16T06:30:00.000Z"
        }
      ]
    }
  }
  ```

---

#### Action: `move`

Relocates assets to a target project by re-assigning project relation links in Notion.

- **Request Body:**

  ```json
  {
    "action": "move",
    "mediaIds": ["304ee3b0-289a-817e-8f5a-ce45b13ffeaf", "304ee3b0-289a-81a4-b1c2-d3e4f5a6b7c8"],
    "params": {
      "targetProjectId": "304ee3b0-289a-81f5-9261-c410967f5a36"
    }
  }
  ```

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "updatedCount": 2,
    "message": "2 assets successfully relocated to target project.",
    "data": null
  }
  ```

---

### 5. Pre-Signed Downloads & Delivery

#### `POST /api/media/downloads`

Generates temporary, pre-signed download URLs for high-resolution assets stored in Cloudflare R2 (valid for 3,600 seconds). Supports explicit asset selections or project-wide status filters. The organization slug is sent in the `x-org-id` header.

- **Request Body:**

  | Field       | Type       | Required | Description                                                                                                         |
  | :---------- | :--------- | :------: | :------------------------------------------------------------------------------------------------------------------ |
  | `projectId` | `string`   | **Yes**  | Notion project page UUID.                                                                                           |
  | `mediaIds`  | `string[]` |    No    | Specific array of Notion media page UUIDs.                                                                          |
  | `params`    | `object`   |    No    | Filter parameters: `{ "version": string, "status": "plan" \| "pending" \| "approved" \| "rejected" \| "release" }`. |

- **Request:**

  ```bash
  curl -X POST "https://drive.example.com/api/media/downloads" \
    -H "Content-Type: application/json" \
    -H "x-org-id: red-cat-pictures-3" \
    -d '{
      "projectId": "304ee3b0-289a-81f5-9261-c410967f5a36",
      "mediaIds": ["304ee3b0-289a-817e-8f5a-ce45b13ffeaf"],
      "params": {
        "status": "approved"
      }
    }'
  ```

- **Response `200 OK`:**
  ```json
  {
    "updatedCount": 1,
    "expiresIn": 3600,
    "assets": [
      {
        "mediaId": "304ee3b0-289a-817e-8f5a-ce45b13ffeaf",
        "filename": "Desert_Look_01.jpg",
        "downloadUrl": "https://storage.r2.cloudflarestorage.com/media-vault/processed/red-cat-pictures-3/304ee3b08a1b81f59261c410967f5a36/photo-0003-0008-0001-001.jpg?X-Amz-Signature=..."
      }
    ]
  }
  ```

---

### 6. Collaboration & Canvas Comments

#### `POST /api/media/comments`

Appends a comment thread or pinned coordinate marker to one or more media assets.

- **Request Body:**

  | Field         | Type                               | Required | Description                                              |
  | :------------ | :--------------------------------- | :------: | :------------------------------------------------------- |
  | `mediaIds`    | `string[]`                         | **Yes**  | Array of target Notion media page UUIDs (minimum 1).     |
  | `parentId`    | `string \| null`                   |    No    | Parent comment ID for nested thread replies.             |
  | `text`        | `string`                           | **Yes**  | Comment content.                                         |
  | `coordinates` | `{ x: number, y: number } \| null` |    No    | Pinned 2D canvas percentages (set to `null` on replies). |
  | `author`      | `{ name: string, role: string }`   | **Yes**  | Author details.                                          |

- **Request:**

  ```bash
  curl -X POST "https://drive.example.com/api/media/comments" \
    -H "Content-Type: application/json" \
    -d '{
      "mediaIds": ["304ee3b0-289a-817e-8f5a-ce45b13ffeaf"],
      "parentId": null,
      "text": "Warm up the highlight values in the top-right corner.",
      "coordinates": { "x": 82.5, "y": 14.2 },
      "author": { "name": "Sarah Connor", "role": "client" }
    }'
  ```

- **Response `200 OK`:**
  ```json
  {
    "comments": [
      {
        "commentId": "cmt_9f8e7d6c",
        "mediaId": "304ee3b0-289a-817e-8f5a-ce45b13ffeaf",
        "parentId": null,
        "text": "Warm up the highlight values in the top-right corner.",
        "coordinates": { "x": 82.5, "y": 14.2 },
        "author": { "name": "Sarah Connor", "role": "client" },
        "createdAt": "2026-10-16T06:30:00.000Z"
      }
    ]
  }
  ```

---

#### `POST /api/media/comments/query`

Retrieves organized discussion trees for given media IDs, automatically assembling root-level pinned comments and their nested chronologically sorted replies.

- **Request Body:**

  ```json
  {
    "mediaIds": ["304ee3b0-289a-817e-8f5a-ce45b13ffeaf"]
  }
  ```

- **Response `200 OK`:**
  ```json
  {
    "timelines": {
      "304ee3b0-289a-817e-8f5a-ce45b13ffeaf": [
        {
          "commentId": "cmt_9f8e7d6c",
          "parentId": null,
          "text": "Warm up the highlight values in the top-right corner.",
          "coordinates": { "x": 82.5, "y": 14.2 },
          "author": { "name": "Sarah Connor", "role": "client" },
          "createdAt": "2026-10-16T06:30:00.000Z",
          "replies": [
            {
              "commentId": "cmt_1a2b3c4d",
              "parentId": "cmt_9f8e7d6c",
              "text": "Adjusted in color pass 2.",
              "coordinates": null,
              "author": { "name": "Alex Editor", "role": "team" },
              "createdAt": "2026-10-16T07:15:00.000Z"
            }
          ]
        }
      ]
    }
  }
  ```

---

### 7. Edge Media Delivery & Transformation

#### `GET /media/:kind/**`

Currently redirects (`302`) to `${NITRO_PRIVATE_MEDIA_REDIRECT_URL}/media/:kind/**`. The in-process transformation pipeline below is disabled behind this redirect.

- **Path Format:** `/media/:kind/:modifiers/:mediaId`
  - `:kind`: `'image' | 'video' | 'audio'`
  - `:modifiers`: Comma-delimited IPX modifiers (e.g. `w_800,q_80,f_webp`) or video streaming directives (e.g. `abr`).
  - `:mediaId`: Asset slug or storage key.

- **Supported Transformations:**
  - **Images:** Width (`w`), Height (`h`), Resize (`s`), Quality (`q`), Blur, Crop, Rotate, Format conversion (`avif`, `webp`, `jpeg` via `Accept` header negotiation).
  - **Video:** Automatic codec negotiation (`av1`, `vp9`, `hevc`, `avc`) and dynamic MPEG-DASH manifest serving (`.mpd`).

---

<details>
<summary><strong>Local Development & Tooling</strong></summary>

### Available Scripts

The following scripts are defined in [`package.json`](file:///d:/Projects/Public/modest-human-brands/code-drive/package.json):

```bash
# Start development server with hot-reload
bun run dev

# Prepare Nitro types and imports
bun run postinstall

# Type-check, lint, and auto-fix codebase
bun run lint

# Format code with Prettier
bun run format

# Run secret scanning with Gitleaks
bun run detect

# Build production bundle
bun run build

# Preview production build locally
bun run preview

# Clean temporary Nitro build artifacts
bun run clean

# Run k6 load test suite
bun run test:load

# Build Docker image
bun run docker:build

# Run Docker container locally
bun run docker:start
```

</details>

---

## License

This project is licensed under the [MIT License](https://github.com/Modest-Human-Brands/mdrive/blob/main/LICENSE).  
Copyright © 2024 Shirsendu Bairagi.

<a href="https://github.com/Modest-Human-Brands/mdrive/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Modest-Human-Brands/mdrive" alt="Contributors" />
</a>
