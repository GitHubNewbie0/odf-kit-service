// src/routes/fill.js
// POST /fill
//
// Body: {
//   templateFileId: number  — Nextcloud file ID of the .odt template
//   data:           object  — key-value data for placeholder replacement
//   outputPath:     string  — destination path in user's Nextcloud, e.g. "Documents/out.odt"
//   userId:         string  — Nextcloud user ID
// }
//
// Returns: { fileId: string|null }
//
// Flow:
//   1. Fetch template bytes from Nextcloud by file ID (WebDAV SEARCH → GET)
//   2. Fill placeholders with fillTemplate() — synchronous, returns Uint8Array
//   3. Write the result back to Nextcloud via WebDAV PUT
//   4. Return the new file's Nextcloud file ID

import { fillTemplate } from 'odf-kit'
import { fetchFileById, putFile } from '../webdav.js'

const ODT_MIME = 'application/vnd.oasis.opendocument.text'

export async function fill(req, res) {
  const { templateFileId, data, outputPath, userId } = req.body

  if (!templateFileId) return res.status(400).json({ error: 'missing templateFileId' })
  if (!data)           return res.status(400).json({ error: 'missing data' })
  if (!outputPath)     return res.status(400).json({ error: 'missing outputPath' })
  if (!userId)         return res.status(400).json({ error: 'missing userId' })

  // Fetch template bytes by file ID (SEARCH to resolve path, then GET)
  const templateBuffer = await fetchFileById(userId, templateFileId)

  // fillTemplate is synchronous — no await needed
  const filledBytes = fillTemplate(new Uint8Array(templateBuffer), data)

  const fileId = await putFile(userId, outputPath, Buffer.from(filledBytes), ODT_MIME)

  res.json({ fileId })
}
