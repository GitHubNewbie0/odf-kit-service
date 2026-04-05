// src/routes/convert-file.js
// POST /ui/convert-file
//
// Called from the top menu UI page when user clicks "Export as ODT".
//
// Accepts: { path: string, userId: string }
//   path   — user-relative file path e.g. "Documents/notes.md"
//   userId — Nextcloud user ID
//
// Fetches the file by WebDAV path, converts based on mime type,
// saves the ODT next to the original file.
//
// Conversion:
//   text/markdown → marked (HTML) → htmlToOdt()
//   text/html     → htmlToOdt() directly
//   text/plain    → wrap lines in <p> → htmlToOdt()

import { htmlToOdt } from 'odf-kit'
import { marked }    from 'marked'

const ODT_MIME = 'application/vnd.oasis.opendocument.text'

/** Replace file extension with .odt */
function toOdtPath(filePath) {
  return filePath.replace(/\.[^/.]+$/, '') + '.odt'
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Convert file bytes to ODT based on mime type. */
async function convertToOdt(buffer, mimeType, fileName) {
  const text  = buffer.toString('utf8')
  const title = fileName.replace(/\.[^.]+$/, '')
  const options = { pageFormat: 'A4', metadata: { title } }

  let html

  if (mimeType === 'text/markdown') {
    html = await marked.parse(text)
  } else if (mimeType === 'text/html') {
    html = text
  } else {
    // text/plain
    html = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${escapeHtml(line)}</p>`)
      .join('\n')
  }

  return htmlToOdt(html, options)
}

/** Build AppAPIAuth header for user-level WebDAV calls. */
function userAuthHeader(userId) {
  return Buffer.from(`${userId}:${process.env.APP_SECRET}`).toString('base64')
}

function webdavHeaders(userId) {
  return {
    'Authorization-App-Api': userAuthHeader(userId),
    'Ex-App-Id':             process.env.APP_ID,
    'Ex-App-Version':        process.env.APP_VERSION,
    'Aa-Version':            process.env.AA_VERSION ?? '2.0.0',
  }
}

const baseUrl = () => process.env.WEBDAV_URL ?? process.env.NEXTCLOUD_URL

/** Fetch a file by user-relative path via WebDAV GET. */
async function fetchFileByPath(userId, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  const url = `${baseUrl()}/remote.php/dav/files/${encodeURIComponent(userId)}/${encodedPath}`
  const res = await fetch(url, { headers: webdavHeaders(userId) })
  if (!res.ok) throw new Error(`WebDAV GET failed: ${res.status} — ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Get mime type for a file via WebDAV PROPFIND. */
async function getMimeType(userId, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  const url = `${baseUrl()}/remote.php/dav/files/${encodeURIComponent(userId)}/${encodedPath}`
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      ...webdavHeaders(userId),
      'Depth': '0',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontenttype/></d:prop></d:propfind>`,
  })
  if (!res.ok) throw new Error(`PROPFIND failed: ${res.status}`)
  const xml = await res.text()
  const match = xml.match(/<[^>]*:getcontenttype[^>]*>([^<]+)</)
  return match ? match[1].trim() : 'text/plain'
}

/** Save ODT bytes via WebDAV PUT. */
async function saveFile(userId, filePath, bytes) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  const url = `${baseUrl()}/remote.php/dav/files/${encodeURIComponent(userId)}/${encodedPath}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...webdavHeaders(userId),
      'Content-Type': ODT_MIME,
    },
    body: bytes,
  })
  if (!res.ok) throw new Error(`WebDAV PUT failed: ${res.status} — ${url}`)
}

export async function convertFile(req, res) {
  const { path: filePath, userId } = req.body

  if (!filePath) return res.status(400).json({ error: 'missing path' })
  if (!userId)   return res.status(400).json({ error: 'missing userId' })

  const fileName   = filePath.split('/').pop() ?? 'document'
  const outputPath = toOdtPath(filePath)

  try {
    const mimeType = await getMimeType(userId, filePath)
    const buffer   = await fetchFileByPath(userId, filePath)
    const bytes    = await convertToOdt(buffer, mimeType, fileName)
    await saveFile(userId, outputPath, Buffer.from(bytes))

    console.log(`Converted ${filePath} → ${outputPath}`)
    res.json({ status: 'ok', outputPath })
  } catch (err) {
    console.error(`Failed to convert ${filePath}:`, err.message)
    res.status(500).json({ error: err.message })
  }
}
