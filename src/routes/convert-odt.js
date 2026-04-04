// src/routes/convert-odt.js
// POST /convert/odt — convert HTML to ODT using htmlToOdt()
//
// This is the reverse of /convert/html. Where /convert/html takes an ODT
// and produces HTML, /convert/odt takes HTML and produces ODT.
//
// Primary use case: Nextcloud Text ODT export. Nextcloud Text produces
// clean, well-formed HTML that maps directly to ODT elements via odf-kit's
// htmlToOdt() function.
//
// Body: {
//   html:         string   — HTML string to convert (fragment or full document)
//   outputPath:   string   — destination path in the user's Nextcloud, e.g. "Documents/notes.odt"
//   userId:       string   — Nextcloud user ID
//   pageFormat?:  string   — "A4" | "letter" | "legal" | "A3" | "A5" (default: "A4")
//   orientation?: string   — "portrait" | "landscape" (default: "portrait")
//   marginTop?:   string   — e.g. "2.5cm"
//   marginBottom?: string
//   marginLeft?:  string
//   marginRight?: string
//   metadata?:    { title?: string, creator?: string, description?: string }
// }
//
// Returns: { fileId: string|null }
//
// To re-register this route with AppAPI after deployment:
//   1. Add the route entry to appinfo/info.xml (already done in v0.2.0)
//   2. Bump <version> in appinfo/info.xml
//   3. On the Nextcloud server: php occ app_api:app:update odf-kit-service

import { htmlToOdt } from 'odf-kit'
import { putFile }   from '../webdav.js'

const ODT_MIME = 'application/vnd.oasis.opendocument.text'

export async function convertOdt(req, res) {
  const {
    html,
    outputPath,
    userId,
    pageFormat,
    orientation,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    metadata,
  } = req.body

  if (!html)        return res.status(400).json({ error: 'missing html' })
  if (!outputPath)  return res.status(400).json({ error: 'missing outputPath' })
  if (!userId)      return res.status(400).json({ error: 'missing userId' })

  const options = {}
  if (pageFormat)   options.pageFormat  = pageFormat
  if (orientation)  options.orientation = orientation
  if (marginTop)    options.marginTop   = marginTop
  if (marginBottom) options.marginBottom = marginBottom
  if (marginLeft)   options.marginLeft  = marginLeft
  if (marginRight)  options.marginRight = marginRight
  if (metadata)     options.metadata    = metadata

  const bytes  = await htmlToOdt(html, options)
  const buffer = Buffer.from(bytes)
  const fileId = await putFile(userId, outputPath, buffer, ODT_MIME)

  res.json({ fileId })
}
