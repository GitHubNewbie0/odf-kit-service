// src/webdav.js
// WebDAV helpers for reading and writing files on the Nextcloud instance.
//
// All calls use AppAPIAuth headers so Nextcloud knows the request comes
// from odf-kit-service acting on behalf of a user.
//
// Outbound auth header format:
//   AUTHORIZATION-APP-API: base64(userId:APP_SECRET)
// For system-level calls with no user: base64(:APP_SECRET) — empty userId.

function makeAuthHeader(userId) {
  const raw = `${userId}:${process.env.APP_SECRET}`
  return Buffer.from(raw).toString('base64')
}

function appApiHeaders(userId) {
  return {
    'Authorization-App-Api': makeAuthHeader(userId),
    'Ex-App-Id':             process.env.APP_ID,
    'Ex-App-Version':        process.env.APP_VERSION,
    'Aa-Version':            process.env.AA_VERSION ?? '2.0.0',
  }
}

/**
 * Fetch a file from Nextcloud via WebDAV using its path.
 *
 * @param {string} userId   - Nextcloud user ID (owner of the file)
 * @param {string} filePath - Path relative to the user's root, e.g. "Documents/template.odt"
 * @returns {Promise<Buffer>}
 */
export async function fetchFile(userId, filePath) {
  const url = `${process.env.NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(userId)}/${filePath}`

  const res = await fetch(url, {
    method: 'GET',
    headers: appApiHeaders(userId),
  })

  if (!res.ok) {
    throw new Error(`WebDAV GET failed: ${res.status} ${res.statusText} — ${url}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Resolve a Nextcloud file ID to its WebDAV path, then fetch the file bytes.
 *
 * Uses the WebDAV SEARCH method (RFC 5323) to query by oc:fileid — the
 * official Nextcloud mechanism for fetching a file when you only have its ID.
 *
 * Flow:
 *   1. SEARCH /remote.php/dav/ with oc:fileid = fileId filter
 *   2. Parse the <d:href> from the multistatus response
 *   3. GET the file directly from that href
 *
 * @param {string} userId - Nextcloud user ID (owner of the file)
 * @param {number|string} fileId - Nextcloud file ID (oc:fileid)
 * @returns {Promise<Buffer>}
 */
export async function fetchFileById(userId, fileId) {
  const searchUrl = `${process.env.NEXTCLOUD_URL}/remote.php/dav/`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:basicsearch>
    <d:select>
      <d:prop>
        <d:displayname/>
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

  const searchRes = await fetch(searchUrl, {
    method: 'SEARCH',
    headers: {
      ...appApiHeaders(userId),
      'Content-Type': 'text/xml',
    },
    body: searchBody,
  })

  if (!searchRes.ok) {
    throw new Error(`WebDAV SEARCH failed: ${searchRes.status} ${searchRes.statusText}`)
  }

  const xml = await searchRes.text()

  // Extract the first <d:href> from the multistatus response.
  // The href looks like: /remote.php/dav/files/alice/Documents/template.odt
  // We match case-insensitively since DAV implementations vary on namespace prefix casing.
  const match = xml.match(/<[^>]*:href[^>]*>([^<]+)<\/[^>]*:href>/i)
  if (!match) {
    throw new Error(`File ID ${fileId} not found for user ${userId}`)
  }

  // The href is a full path on the server — prepend the base URL to fetch it
  const fileUrl = `${process.env.NEXTCLOUD_URL}${match[1].trim()}`

  const fileRes = await fetch(fileUrl, {
    method: 'GET',
    headers: appApiHeaders(userId),
  })

  if (!fileRes.ok) {
    throw new Error(`WebDAV GET by ID failed: ${fileRes.status} ${fileRes.statusText} — ${fileUrl}`)
  }

  const arrayBuffer = await fileRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Write a file to Nextcloud via WebDAV.
 *
 * @param {string} userId   - Nextcloud user ID (owner of the file)
 * @param {string} filePath - Destination path relative to user's root, e.g. "Documents/out.odt"
 * @param {Buffer} buffer   - File contents
 * @param {string} mimeType - MIME type, e.g. "application/vnd.oasis.opendocument.text"
 * @returns {Promise<string|null>} - Nextcloud file ID from x-file-id response header, or null
 */
export async function putFile(userId, filePath, buffer, mimeType) {
  const url = `${process.env.NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(userId)}/${filePath}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...appApiHeaders(userId),
      'Content-Type':   mimeType,
      'Content-Length': String(buffer.byteLength),
    },
    body: buffer,
  })

  if (!res.ok) {
    throw new Error(`WebDAV PUT failed: ${res.status} ${res.statusText} — ${url}`)
  }

  // Nextcloud returns the new file ID in x-file-id on create (201),
  // and on overwrite (204) it may or may not be present.
  return res.headers.get('x-file-id') ?? null
}
