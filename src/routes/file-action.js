// src/routes/file-action.js
// POST /file-action
//
// Called by AppAPI when a user clicks "Export as ODT" in the Nextcloud Files
// context menu. Supports single and multi-file selection.
//
// AppAPI sends:
// {
//   actionName: string        — name of the action (odf-export-md, etc.)
//   actionHandler: string     — "file-action"
//   fileIds: number[]         — selected file IDs (one or more)
//   userId: string            — Nextcloud user ID
// }
//
// For each file:
//   1. Fetch bytes by file ID (WebDAV SEARCH → GET)
//   2. Determine output path: same folder, .odt extension
//   3. Convert based on mime type
//   4. Save ODT to Nextcloud via WebDAV PUT
//
// Returns: { results: Array<{ fileId, outputPath, status, error? }> }
//
// Conversion logic:
//   text/markdown → marked (HTML) → htmlToOdt()
//   text/html     → htmlToOdt() directly
//   text/plain    → wrap lines in <p> → htmlToOdt()

import { htmlToOdt }      from 'odf-kit'
import { marked }         from 'marked'
import { fetchFileById, putFile } from '../webdav.js'

const ODT_MIME = 'application/vnd.oasis.opendocument.text'

/**
 * Convert file bytes to ODT based on mime type.
 *
 * @param {Buffer} buffer   - File contents
 * @param {string} mimeType - Source mime type
 * @param {string} fileName - Original file name (used for metadata title)
 * @returns {Promise<Uint8Array>} - ODT bytes
 */
async function convertToOdt(buffer, mimeType, fileName) {
  const text = buffer.toString('utf8')
  const title = fileName.replace(/\.[^.]+$/, '') // strip extension

  const options = {
    pageFormat: 'A4',
    metadata:   { title },
  }

  let html

  if (mimeType === 'text/markdown') {
    // marked converts markdown to HTML — feeds directly into htmlToOdt()
    html = await marked.parse(text)
  } else if (mimeType === 'text/html') {
    html = text
  } else {
    // text/plain — wrap each non-empty line in a paragraph
    html = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${escapeHtml(line)}</p>`)
      .join('\n')
  }

  return htmlToOdt(html, options)
}

/** Escape HTML special characters for plain text wrapping. */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Resolve output path: same directory as input, with .odt extension.
 * e.g. "Documents/notes.md" → "Documents/notes.odt"
 *      "report.html"        → "report.odt"
 */
function resolveOutputPath(inputPath) {
  return inputPath.replace(/\.[^/.]+$/, '') + '.odt'
}

/**
 * Extract the file name from a WebDAV href.
 * e.g. "/remote.php/dav/files/alice/Documents/notes.md" → "notes.md"
 */
function fileNameFromHref(href) {
  return href.split('/').pop() ?? 'document'
}

/**
 * Extract the user-relative file path from a WebDAV href.
 * e.g. "/remote.php/dav/files/alice/Documents/notes.md"
 *      → "Documents/notes.md"
 */
function relativePathFromHref(href, userId) {
  const prefix = `/remote.php/dav/files/${encodeURIComponent(userId)}/`
  const idx = href.indexOf(prefix)
  if (idx === -1) return fileNameFromHref(href)
  return decodeURIComponent(href.slice(idx + prefix.length))
}

/**
 * Fetch a file's WebDAV href and mime type via PROPFIND.
 * Returns { href, mimeType } or throws.
 */
async function propfindFile(userId, fileId) {
  const baseUrl = process.env.WEBDAV_URL ?? process.env.NEXTCLOUD_URL
  const searchUrl = `${baseUrl}/remote.php/dav/`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:basicsearch>
    <d:select>
      <d:prop>
        <d:displayname/>
        <d:getcontenttype/>
      </d:prop>
    </d:select>
    <d:from>
      <d:scope>
        <d:href>/files/${encodeURIComponent(userId)}</d:href>
        <d:depth>infinity</d:depth>
      </d:scope>
    </d:from>
    <d:where>
      <d:eq>
        <d:prop>
          <oc:fileid/>
        </d:prop>
        <d:literal>${fileId}</d:literal>
      </d:eq>
    </d:where>
    <d:orderby/>
  </d:basicsearch>
</d:searchrequest>`

  const authHeader = Buffer.from(`${userId}:${process.env.APP_SECRET}`).toString('base64')

  const res = await fetch(searchUrl, {
    method:  'SEARCH',
    headers: {
      'Content-Type':          'text/xml',
      'Authorization-App-Api': authHeader,
      'Ex-App-Id':             process.env.APP_ID,
      'Ex-App-Version':        process.env.APP_VERSION,
      'Aa-Version':            process.env.AA_VERSION ?? '2.0.0',
    },
    body: searchBody,
  })

  if (!res.ok) throw new Error(`PROPFIND failed: ${res.status}`)

  const xml = await res.text()

  const hrefMatch = xml.match(/<[^>]*:href[^>]*>([^<]+)<\/[^>]*:href>/i)
  if (!hrefMatch) throw new Error(`File ID ${fileId} not found`)

  const href = hrefMatch[1].trim()

  const mimeMatch = xml.match(/<[^>]*:getcontenttype[^>]*>([^<]+)<\/[^>]*:getcontenttype>/i)
  const mimeType = mimeMatch ? mimeMatch[1].trim() : 'text/plain'

  return { href, mimeType }
}

export async function fileAction(req, res) {
  const { fileIds, userId } = req.body

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({ error: 'missing fileIds' })
  }
  if (!userId) {
    return res.status(400).json({ error: 'missing userId' })
  }

  const results = []

  for (const fileId of fileIds) {
    try {
      // Get file path and mime type
      const { href, mimeType } = await propfindFile(userId, fileId)
      const relativePath = relativePathFromHref(href, userId)
      const fileName = fileNameFromHref(href)
      const outputPath = resolveOutputPath(relativePath)

      // Fetch file bytes
      const buffer = await fetchFileById(userId, fileId)

      // Convert to ODT
      const bytes = await convertToOdt(buffer, mimeType, fileName)

      // Save to Nextcloud
      const outFileId = await putFile(userId, outputPath, Buffer.from(bytes), ODT_MIME)

      results.push({ fileId, outputPath, status: 'ok', outFileId })
      console.log(`Exported ${relativePath} → ${outputPath}`)
    } catch (err) {
      console.error(`Failed to export file ${fileId}:`, err.message)
      results.push({ fileId, status: 'error', error: err.message })
    }
  }

  res.json({ results })
}
