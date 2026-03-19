# odf-kit-service

A [Nextcloud ExApp](https://nextcloud.github.io/app_api) that exposes [odf-kit](https://github.com/GitHubNewbie0/odf-kit) as a shared HTTP service for other ExApps in the Nextcloud ecosystem.

No UI. Pure service layer. Install it once, and any ExApp in your Nextcloud instance can generate, fill, read, and convert ODT documents without bundling odf-kit themselves.

**License:** AGPLv3  
**Runtime:** Node.js 22, Express 5, ESM  
**odf-kit version:** 0.8.0

---

## What it does

odf-kit-service wraps the full odf-kit API as an HTTP service:

| Endpoint | What it does |
|---|---|
| `POST /generate` | Build a new ODT document from a JSON spec and save it to Nextcloud |
| `POST /fill` | Fill an ODT template with data and save the result to Nextcloud |
| `POST /convert/html` | Convert an ODT file to an HTML string |
| `POST /convert/typst` | Convert an ODT file to Typst markup |
| `POST /convert/pdf` | Convert an ODT file to PDF via the bundled Typst compiler |

All file operations use Nextcloud file IDs and WebDAV — no binary payloads over the broker.

---

## Architecture

ExApp-to-ExApp calls go through Nextcloud as a broker. Callers never need our host, port, or IP — only our app ID: `odf-kit-service`.

```
Calling ExApp
  └── POST /ocs/v2.php/apps/app_api/api/v1/ex-app/request/odf-kit-service
        └── Nextcloud (broker)
              └── odf-kit-service container
                    ├── WebDAV GET  (fetch source file from Nextcloud)
                    ├── odf-kit     (process)
                    └── WebDAV PUT  (write result back to Nextcloud)
```

Example broker call from another ExApp:

```json
POST /ocs/v2.php/apps/app_api/api/v1/ex-app/request/odf-kit-service
{
  "route": "/fill",
  "method": "POST",
  "params": {
    "templateFileId": 123,
    "data": { "customer": "Acme Corp", "date": "2026-03-19" },
    "outputPath": "Documents/invoice.odt",
    "userId": "alice"
  },
  "options": {}
}
```

---

## API Reference

All endpoints require AppAPIAuth (injected by Nextcloud). `/heartbeat` is the only unauthenticated endpoint.

### `POST /generate`

Build a new ODT document from a JSON spec.

**Body:**
```json
{
  "spec": {
    "metadata": { "title": "My Document", "creator": "Alice" },
    "content": [
      { "type": "heading", "text": "Hello", "level": 1 },
      { "type": "paragraph", "text": "Plain paragraph." },
      { "type": "paragraph", "spans": [
        { "text": "Bold " , "bold": true },
        { "text": "and italic.", "italic": true }
      ]}
    ]
  },
  "outputPath": "Documents/hello.odt",
  "userId": "alice"
}
```

**Returns:** `{ "fileId": "456" }`

---

### `POST /fill`

Fill an ODT template with data. Placeholders in the template use `{{key}}` syntax (odf-kit template format).

**Body:**
```json
{
  "templateFileId": 123,
  "data": {
    "customer": "Acme Corp",
    "date": "2026-03-19",
    "total": 245
  },
  "outputPath": "Documents/invoice-filled.odt",
  "userId": "alice"
}
```

**Returns:** `{ "fileId": "457" }`

---

### `POST /convert/html`

Convert an ODT file to HTML. Returns the HTML string inline, or saves it to Nextcloud if `outputPath` is provided.

**Body:**
```json
{
  "fileId": 123,
  "userId": "alice",
  "outputPath": "Documents/doc.html"
}
```

**Returns:** `{ "html": "<h1>...</h1>" }` or `{ "fileId": "458" }` if `outputPath` given.

---

### `POST /convert/typst`

Convert an ODT file to [Typst](https://typst.app) markup. Returns the markup inline, or saves to Nextcloud if `outputPath` is provided.

**Body:**
```json
{
  "fileId": 123,
  "userId": "alice"
}
```

**Returns:** `{ "typst": "= Heading\n\nParagraph text." }`

---

### `POST /convert/pdf`

Convert an ODT file to PDF via the bundled Typst compiler. `outputPath` is required.

**Body:**
```json
{
  "fileId": 123,
  "outputPath": "Documents/doc.pdf",
  "userId": "alice"
}
```

**Returns:** `{ "fileId": "459" }`

---

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 22 (for running the service directly without Docker)

### Start the dev environment

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- Nextcloud 31 at `http://localhost:8080` (admin/admin)
- PostgreSQL 16
- odf-kit-service at `http://localhost:2600` (with `src/` hot-reloaded via `node --watch`)

### Register the ExApp with Nextcloud

Run once after the containers are up:

```bash
bash dev-setup.sh
```

This installs AppAPI, registers a `manual_install` daemon, and registers `odf-kit-service` with Nextcloud so it appears as an installed ExApp.

### Run the service directly (without Docker)

```bash
cp .env.dev .env
node --env-file=.env src/server.js
```

Or with hot reload:

```bash
node --env-file=.env --watch src/server.js
```

---

## Docker Image

Multi-arch image (linux/amd64 + linux/arm64) built and pushed to GitHub Container Registry on every version tag.

```bash
docker pull ghcr.io/githubnewbie0/odf-kit-service:latest
```

The image bundles:
- Node.js 22 slim base
- Typst compiler (static musl binary, correct arch selected at build time)
- Liberation, DejaVu, and Noto Core fonts with `fc-cache` pre-run

To build locally:

```bash
docker build -t odf-kit-service .
```

---

## Environment Variables

Injected by AppAPI at runtime. For local development, copy `.env.dev` and adjust as needed.

| Variable | Description |
|---|---|
| `APP_SECRET` | Shared secret for AppAPIAuth validation |
| `APP_ID` | `odf-kit-service` |
| `APP_VERSION` | Version string |
| `APP_HOST` | Host to listen on |
| `APP_PORT` | Port to listen on |
| `APP_DISPLAY_NAME` | Display name |
| `APP_PERSISTENT_STORAGE` | Path to persistent Docker volume |
| `NEXTCLOUD_URL` | Base URL of the Nextcloud instance |
| `AA_VERSION` | AppAPI version (injected by AppAPI) |

---

## Related

- [odf-kit](https://github.com/GitHubNewbie0/odf-kit) — the underlying library
- [Nextcloud AppAPI](https://nextcloud.github.io/app_api) — ExApp documentation
- [Typst](https://typst.app) — the PDF compiler bundled in the image

---

## License

AGPLv3 — required by the Nextcloud App Store. See [LICENSE](LICENSE).
