// src/routes/generate.js
// POST /generate
//
// Body: {
//   spec:       object  — document spec (see below)
//   outputPath: string  — destination path in the user's Nextcloud, e.g. "Documents/letter.odt"
//   userId:     string  — Nextcloud user ID
// }
//
// Returns: { fileId: string|null }
//
// Spec shape:
// {
//   metadata: { title?, creator?, subject?, description? },
//   content:  Array of content nodes — see applyContent() below
// }
//
// Content node types:
//   { type: 'heading',   text: string, level?: number }
//   { type: 'paragraph', text?: string, spans?: Array<{ text, bold?, italic?, fontSize?, fontFamily? }> }
//
// For plain paragraphs and headings, pass text directly.
// For rich paragraphs, pass spans — each span maps to a ParagraphBuilder.addText() call.

import { OdtDocument } from 'odf-kit'
import { putFile } from '../webdav.js'

const ODT_MIME = 'application/vnd.oasis.opendocument.text'

function buildOdt(spec) {
  const doc = new OdtDocument()

  if (spec.metadata) {
    doc.setMetadata(spec.metadata)
  }

  if (Array.isArray(spec.content)) {
    applyContent(doc, spec.content)
  }

  return doc.save() // Promise<Uint8Array>
}

function applyContent(doc, nodes) {
  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        doc.addHeading(node.text ?? '', node.level ?? 1)
        break

      case 'paragraph':
        if (Array.isArray(node.spans) && node.spans.length > 0) {
          // Rich paragraph — use the callback form so each span gets its own
          // formatting. addParagraph() returns `this` (the document), not a
          // builder, so all span work must happen inside the callback.
          doc.addParagraph((p) => {
            for (const span of node.spans) {
              p.addText(span.text ?? '', {
                bold:       span.bold,
                italic:     span.italic,
                fontSize:   span.fontSize,
                fontFamily: span.fontFamily,
              })
            }
          })
        } else {
          // Plain paragraph
          doc.addParagraph(node.text ?? '')
        }
        break

      default:
        console.warn(`generate: unknown content node type "${node.type}" — skipped`)
    }
  }
}

export async function generate(req, res) {
  const { spec, outputPath, userId } = req.body

  if (!spec)        return res.status(400).json({ error: 'missing spec' })
  if (!outputPath)  return res.status(400).json({ error: 'missing outputPath' })
  if (!userId)      return res.status(400).json({ error: 'missing userId' })

  const bytes   = await buildOdt(spec)
  const buffer  = Buffer.from(bytes)
  const fileId  = await putFile(userId, outputPath, buffer, ODT_MIME)

  res.json({ fileId })
}
