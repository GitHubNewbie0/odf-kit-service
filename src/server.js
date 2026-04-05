// src/server.js

import express      from 'express'
import { requireAuth }  from './auth.js'
import { heartbeat }    from './routes/heartbeat.js'
import { enabled }      from './routes/enabled.js'
import { generate }     from './routes/generate.js'
import { fill }         from './routes/fill.js'
import { convert }      from './routes/convert.js'
import { convertOdt }   from './routes/convert-odt.js'
import { fileAction }   from './routes/file-action.js'
import { init }         from './routes/init.js'

const app = express()

app.use(express.json({ limit: '10mb' }))

// Lifecycle — no auth on heartbeat
app.get('/heartbeat',      heartbeat)
app.put('/enabled',        requireAuth, enabled)
app.post('/init',          requireAuth, init)

// Service routes
app.post('/generate',      requireAuth, generate)
app.post('/fill',          requireAuth, fill)
app.post('/convert/html',  requireAuth, (req, res) => convert(req, res, 'html'))
app.post('/convert/typst', requireAuth, (req, res) => convert(req, res, 'typst'))
app.post('/convert/pdf',   requireAuth, (req, res) => convert(req, res, 'pdf'))
app.post('/convert/odt',   requireAuth, convertOdt)
app.post('/file-action',   requireAuth, fileAction)

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message ?? 'internal error' })
})

const port = parseInt(process.env.APP_PORT)
const host = process.env.APP_HOST

app.listen(port, host, () => {
  console.log(`odf-kit-service ${process.env.APP_VERSION} listening on ${host}:${port}`)
})
