# odf-kit-service

A [Nextcloud ExApp](https://nextcloud.github.io/app_api) that converts Markdown, HTML, and plain text files to ODT format directly within your Nextcloud instance. Available in the [Nextcloud App Store](https://apps.nextcloud.com/apps/odf_kit_service) and as a [Docker image](https://github.com/GitHubNewbie0/odf-kit-service/pkgs/container/odf-kit-service).

Powered by [odf-kit](https://github.com/GitHubNewbie0/odf-kit) — a zero-dependency JavaScript library for ODF document generation. No LibreOffice required.

**License:** AGPLv3  
**Runtime:** Node.js 22, Express 5, ESM  
**App ID:** `odf_kit_service`

---

## Features

- **Export to ODT** from the Nextcloud top menu — pick any Markdown, HTML, or plain text file and convert it to ODT with a single click
- **Page format selection** — A4 (Europe), Letter (USA), Legal, A3, or A5
- **HTTP API** for other ExApps and integrations
- **No LibreOffice dependency** — pure Node.js, runs anywhere

---

## Installation

### App Store (recommended)

Install directly from the Nextcloud App Store. Requires a Docker-capable Nextcloud setup with AppAPI and a registered Deploy Daemon.

### Manual Install (without Docker)

For FreeBSD, Linux without Docker, jails, or any environment where you run Node.js directly.

#### Prerequisites

- Node.js 22 or later
- npm
- A running Nextcloud instance with AppAPI installed

#### Step 1 — Clone and install dependencies

```sh
git clone https://github.com/GitHubNewbie0/odf-kit-service.git
cd odf-kit-service
npm install --omit=dev
```

#### Step 2 — Create the `.env` file

```sh
cp .env.example .env
```

Edit `.env` and set the following values:

```env
APP_ID=odf_kit_service
APP_SECRET=              # Set this AFTER registration (see Step 4)
APP_VERSION=0.4.0
APP_HOST=0.0.0.0
APP_PORT=2600
AA_VERSION=2.0.0
NEXTCLOUD_URL=http://your-nextcloud-host
WEBDAV_URL=http://your-nextcloud-host
```

#### Step 3 — Start the service

**Linux (systemd):**

Create `/etc/systemd/system/odf-kit-service.service`:

```ini
[Unit]
Description=odf-kit-service Nextcloud ExApp
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/odf-kit-service
EnvironmentFile=/path/to/odf-kit-service/.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```sh
systemctl enable odf-kit-service
systemctl start odf-kit-service
```

**FreeBSD (rc.d):**

Create `/usr/local/etc/rc.d/odf_kit_service`:

```sh
#!/bin/sh
# PROVIDE: odf_kit_service
# REQUIRE: NETWORKING
# KEYWORD: shutdown

. /etc/rc.subr

name="odf_kit_service"
rcvar="odf_kit_service_enable"
command="/usr/local/bin/node"
command_args="/path/to/odf-kit-service/src/server.js"
pidfile="/var/run/${name}.pid"

load_rc_config $name
run_rc_command "$1"
```

Then:
```sh
chmod +x /usr/local/etc/rc.d/odf_kit_service
sysrc odf_kit_service_enable=YES
service odf_kit_service start
```

#### Step 4 — Register with Nextcloud

Run this command from your Nextcloud directory (replace `SECRET` with a long random string, and update `host` and `port` to match your setup):

```sh
php occ app_api:app:register odf_kit_service manual_install \
  --force-scopes \
  --json-info '{
    "id": "odf_kit_service",
    "name": "odf-kit Service",
    "daemon_config_name": "manual_install",
    "version": "0.4.0",
    "secret": "SECRET",
    "host": "localhost",
    "port": 2600,
    "scopes": ["FILES"],
    "system": 0,
    "routes": [
      {"url": "/generate",     "verb": "POST", "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[401,500]"},
      {"url": "/fill",         "verb": "POST", "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[401,500]"},
      {"url": "/convert/odt",  "verb": "POST", "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[401,500]"},
      {"url": "/file-action",  "verb": "POST", "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[401,500]"},
      {"url": "ui",            "verb": "GET",  "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[]"},
      {"url": "ui",            "verb": "POST", "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[401,500]"},
      {"url": "img",           "verb": "GET",  "access_level": 1, "headers_to_exclude": "[]", "bruteforce_protection": "[]"}
    ]
  }'
```

#### Step 5 — Sync the secret

After registration, retrieve the secret AppAPI generated and update your `.env` file:

```sh
# On your Nextcloud server (MariaDB/MySQL):
mysql -u root nextcloud -e "SELECT secret FROM oc_ex_apps WHERE appid='odf_kit_service';"
```

Copy the output and set it as `APP_SECRET` in your `.env` file, then restart the service.

#### Step 6 — Enable the app

```sh
php occ app_api:app:enable odf_kit_service
```

The **Export to ODT** icon will appear in the Nextcloud top navigation bar.

#### Updating

```sh
cd /path/to/odf-kit-service
git pull
npm install --omit=dev
# Restart the service
```

If the version number changed, update `APP_VERSION` in `.env` and re-register:

```sh
php occ app_api:app:unregister odf_kit_service --force
# Then repeat Step 4 with the new version number
```

---

## Calling odf-kit-service from Other Apps

Any Nextcloud app — PHP app, ExApp, or browser-based frontend — can call odf-kit-service via the AppAPI proxy. No knowledge of our host, port, or IP is needed.

### From a PHP Nextcloud app

Use Nextcloud's HTTP client with the AppAPI proxy URL:

```php
use OCP\Http\Client\IClientService;

$response = $clientService->newClient()->post(
    'http://localhost/apps/app_api/proxy/odf_kit_service/convert/odt',
    [
        'json' => [
            'html'       => '<h1>Title</h1><p>Content</p>',
            'outputPath' => 'Documents/export.odt',
            'userId'     => $userId,
            'pageFormat' => 'A4',
        ],
        'headers' => [
            'AA-VERSION'              => '2.0.0',
            'EX-APP-ID'               => 'your-app-id',
            'AUTHORIZATION-APP-API'   => base64_encode($userId . ':' . $appSecret),
        ],
    ]
);
```

### From another ExApp (Node.js)

```javascript
const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL
const APP_SECRET    = process.env.APP_SECRET
const APP_ID        = process.env.APP_ID

async function convertToOdt(html, outputPath, userId) {
  const auth = Buffer.from(`${userId}:${APP_SECRET}`).toString('base64')

  const res = await fetch(`${NEXTCLOUD_URL}/apps/app_api/proxy/odf_kit_service/convert/odt`, {
    method: 'POST',
    headers: {
      'Content-Type':           'application/json',
      'AA-VERSION':             process.env.AA_VERSION ?? '2.0.0',
      'EX-APP-ID':              APP_ID,
      'AUTHORIZATION-APP-API':  auth,
    },
    body: JSON.stringify({ html, outputPath, userId, pageFormat: 'A4' }),
  })

  return res.json()
}
```

### From a browser (Nextcloud frontend)

Use the AppAPI proxy with the Nextcloud request token:

```javascript
const response = await fetch('/apps/app_api/proxy/odf_kit_service/convert/odt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'requesttoken': OC.requestToken,
  },
  body: JSON.stringify({
    html:       '<h1>Title</h1><p>Content</p>',
    outputPath: 'Documents/export.odt',
    userId:     OC.currentUser,
    pageFormat: 'A4',
  }),
})
const data = await response.json()
```

---



All endpoints require AppAPIAuth (injected automatically by Nextcloud). `/heartbeat` is the only unauthenticated endpoint.

### Top Menu UI

Users access the export UI via the **Export to ODT** icon in the Nextcloud top navigation bar. The UI allows selecting a file and page format, then converts and saves the ODT file next to the original.

### `POST /ui/convert-file`

Called by the top menu UI. Fetches a file from Nextcloud via WebDAV, converts it, and saves the ODT back to Nextcloud.

**Body:**
```json
{
  "path": "/Documents/notes.md",
  "userId": "alice",
  "pageFormat": "A4"
}
```

**Returns:** `{ "status": "ok", "outputPath": "/Documents/notes.odt" }`

**Supported page formats:** `A4`, `letter`, `legal`, `A3`, `A5`

---

### `POST /generate`

Build a new ODT document from a JSON spec and save it to Nextcloud.

**Body:**
```json
{
  "spec": {
    "metadata": { "title": "My Document", "creator": "Alice" },
    "content": [
      { "type": "heading", "text": "Hello", "level": 1 },
      { "type": "paragraph", "text": "Plain paragraph." }
    ]
  },
  "outputPath": "Documents/hello.odt",
  "userId": "alice"
}
```

**Returns:** `{ "fileId": "456" }`

---

### `POST /fill`

Fill an ODT template with data. Placeholders use `{{key}}` syntax.

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

### `POST /convert/odt`

Convert an HTML string to ODT and save it to Nextcloud.

**Body:**
```json
{
  "html": "<h1>Title</h1><p>Content</p>",
  "outputPath": "Documents/doc.odt",
  "userId": "alice",
  "pageFormat": "A4"
}
```

**Returns:** `{ "fileId": "458" }`

---

### `POST /convert/html`

Convert an ODT file to HTML.

**Body:**
```json
{
  "fileId": 123,
  "userId": "alice"
}
```

**Returns:** `{ "html": "<h1>...</h1>" }`

---

### `POST /convert/typst`

Convert an ODT file to [Typst](https://typst.app) markup.

**Body:**
```json
{
  "fileId": 123,
  "userId": "alice"
}
```

**Returns:** `{ "typst": "= Heading\n\nParagraph text." }`

---

## Environment Variables

| Variable | Description |
|---|---|
| `APP_ID` | `odf_kit_service` |
| `APP_SECRET` | Shared secret for AppAPIAuth — must match the value in Nextcloud's database |
| `APP_VERSION` | Version string — must match the registered version |
| `APP_HOST` | Host to listen on (use `0.0.0.0` for AppAPI reachability) |
| `APP_PORT` | Port to listen on (default: `2600`) |
| `AA_VERSION` | AppAPI version (injected automatically in Docker) |
| `NEXTCLOUD_URL` | Base URL of the Nextcloud instance |
| `WEBDAV_URL` | Base URL for WebDAV calls (usually same as `NEXTCLOUD_URL`) |

In Docker deployments, AppAPI injects `APP_ID`, `APP_SECRET`, `APP_HOST`, `APP_PORT`, `APP_VERSION`, `APP_DISPLAY_NAME`, `APP_PERSISTENT_STORAGE`, `NEXTCLOUD_URL`, `AA_VERSION`, and `COMPUTE_DEVICE` automatically. No `.env` file is needed.

---

## Related

- [odf-kit](https://github.com/GitHubNewbie0/odf-kit) — the underlying library
- [Nextcloud AppAPI](https://nextcloud.github.io/app_api) — ExApp documentation

---

## License

AGPLv3 — required by the Nextcloud App Store. See [LICENSE](LICENSE).
