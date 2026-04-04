// src/routes/file-action.js
// POST /file-action
//
// Called by AppAPI when a user clicks "Export as ODT" in the Nextcloud Files
// context menu.
//
// AppAPI sends per-file:
// {
//   fileId:    string   — Nextcloud file ID
//   name:      string   — filename (e.g. "notes.md")
//   directory: string   — path relative to user root (e.g. "Documents")
//   mime:      string   — file mime type
//   userId:    string   — Nextcloud user ID
// }
//
// Flow:
//   1. Construct input path from directory + name
//   2. Fetch file bytes by ID via WebDAV
//   3. Convert based on mime type
//   4. Save ODT next to original file
//
// Conversion:
//   text/markdown → marked (HTML) → htmlToOdt()
//   text/html     → htmlToOdt() directly
//   text/plain    → wrap lines in <p> → htmlToOdt()

import { htmlToOdt }      from 'odf-kit'
import { marked }         from 'marked'
import { fetchFileById, putFile } from '../webdav.js'

const ODT_MIME = 'application/vnd.oasis.opendocument.text'

/** Convert file contents to ODT based on mime type. */
async function convertToOdt(buffer, mimeType, fileName) {
  const text = buffer.toString('utf8')
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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Replace file extension with .odt */
function toOdtName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '') + '.odt'
}

/** Build user-relative file path from directory and filename. */
function buildPath(directory, fileName) {
  if (!directory || directory === '/' || directory === '') return fileName
  return `${directory.replace(/^\//, '')}/${fileName}`
}

export async function fileAction(req, res) {
  const { fileId, name, directory, mime, userId } = req.body

  if (!fileId)  return res.status(400).json({ error: 'missing fileId' })
  if (!name)    return res.status(400).json({ error: 'missing name' })
  if (!userId)  return res.status(400).json({ error: 'missing userId' })

  const mimeType   = mime ?? 'text/plain'
  const outputName = toOdtName(name)
  const outputPath = buildPath(directory, outputName)

  try {
    const buffer  = await fetchFileById(userId, fileId)
    const bytes   = await convertToOdt(buffer, mimeType, name)
    const outFileId = await putFile(userId, outputPath, Buffer.from(bytes), ODT_MIME)

    console.log(`Exported ${buildPath(directory, name)} → ${outputPath}`)
    res.json({ status: 'ok', outputPath, fileId: outFileId })
  } catch (err) {
    console.error(`Failed to export file ${fileId}:`, err.message)
    res.status(500).json({ error: err.message })
  }
}
