// src/routes/convert.js
// POST /convert/html   — convert ODT to HTML string
// POST /convert/typst  — convert ODT to Typst markup string
// POST /convert/pdf    — convert ODT → Typst → PDF via typst CLI
//
// Body: {
//   fileId:      number  — Nextcloud file ID of the source .odt file
//   userId:      string  — Nextcloud user ID
//   outputPath?: string  — if provided, write result back to Nextcloud and return { fileId }
//                          if omitted, return inline { html } or { typst }
//                          (outputPath is required for pdf — no inline binary)
// }
//
// Returns:
//   html/typst without outputPath: { html: string } / { typst: string }
//   html/typst with outputPath:    { fileId: string|null }
//   pdf:                           { fileId: string|null }

import { odtToHtml }   from 'odf-kit/reader'
import { odtToTypst }  from 'odf-kit/typst'
import { fetchFileById, putFile } from '../webdav.js'
import { spawn }       from 'node:child_process'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { tmpdir }      from 'node:os'
import { join }        from 'node:path'
import { randomUUID }  from 'node:crypto'

const HTML_MIME  = 'text/html'
const TYPST_MIME = 'text/plain'
const PDF_MIME   = 'application/pdf'

export async function convert(req, res, mode) {
  const { fileId, userId, outputPath } = req.body

  if (!fileId)  return res.status(400).json({ error: 'missing fileId' })
  if (!userId)  return res.status(400).json({ error: 'missing userId' })
  if (mode === 'pdf' && !outputPath) {
    return res.status(400).json({ error: 'outputPath is required for pdf conversion' })
  }

  // Fetch the source ODT bytes by file ID
  const buffer = await fetchFileById(userId, fileId)
  const bytes  = new Uint8Array(buffer)

  if (mode === 'html') {
    const html = odtToHtml(bytes)
    if (outputPath) {
      const outFileId = await putFile(userId, outputPath, Buffer.from(html), HTML_MIME)
      return res.json({ fileId: outFileId })
    }
    return res.json({ html })
  }

  if (mode === 'typst') {
    const typst = odtToTypst(bytes)
    if (outputPath) {
      const outFileId = await putFile(userId, outputPath, Buffer.from(typst), TYPST_MIME)
      return res.json({ fileId: outFileId })
    }
    return res.json({ typst })
  }

  if (mode === 'pdf') {
    const typst   = odtToTypst(bytes)
    const id      = randomUUID()
    const typPath = join(tmpdir(), `${id}.typ`)
    const pdfPath = join(tmpdir(), `${id}.pdf`)

    try {
      // Write .typ to temp dir
      await writeFile(typPath, typst, 'utf8')

      // Compile with typst CLI — ships in the Docker image for both amd64 and arm64
      await runTypst(typPath, pdfPath)

      // Read compiled PDF and push to Nextcloud
      const pdfBuffer = await readFile(pdfPath)
      const outFileId = await putFile(userId, outputPath, pdfBuffer, PDF_MIME)

      res.json({ fileId: outFileId })
    } finally {
      // Clean up temp files regardless of success or failure
      await unlink(typPath).catch(() => {})
      await unlink(pdfPath).catch(() => {})
    }
  }
}

/**
 * Invoke the typst CLI to compile a .typ file to PDF.
 *
 * @param {string} inputPath  - Absolute path to the .typ source file
 * @param {string} outputPath - Absolute path for the compiled .pdf output
 * @returns {Promise<void>}
 */
function runTypst(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('typst', ['compile', inputPath, outputPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`typst compile failed (exit ${code}): ${stderr.trim()}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`typst not found or could not be spawned: ${err.message}`))
    })
  })
}
