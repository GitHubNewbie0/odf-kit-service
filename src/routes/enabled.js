// src/routes/enabled.js
// AppAPI calls PUT /enabled?enabled=1 when the app is activated,
// and PUT /enabled?enabled=0 when it is deactivated.
//
// On enable:  register top menu entry + associated script
// On disable: unregister them

const TOP_MENU_NAME = 'convert'
const SCRIPT_NAME   = 'convert-main'
const SCRIPT_PATH   = 'ui/convert-main'  // .js appended by AppAPI

function systemAuthHeader() {
  return Buffer.from(`:${process.env.APP_SECRET}`).toString('base64')
}

function ocsHeaders() {
  return {
    'Content-Type':          'application/json',
    'OCS-APIRequest':        'true',
    'Authorization-App-Api': systemAuthHeader(),
    'Ex-App-Id':             process.env.APP_ID,
    'Ex-App-Version':        process.env.APP_VERSION,
    'Aa-Version':            process.env.AA_VERSION ?? '2.0.0',
  }
}

const baseUrl = () => process.env.WEBDAV_URL ?? process.env.NEXTCLOUD_URL

async function ocsPost(path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method:  'POST',
    headers: ocsHeaders(),
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text}`)
  }
  return res
}

async function ocsDelete(path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method:  'DELETE',
    headers: ocsHeaders(),
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`DELETE ${path} failed: ${res.status}`)
  }
  return res
}

async function registerAll() {
  // Register top menu entry
  await ocsPost('/ocs/v2.php/apps/app_api/api/v1/ui/top-menu', {
    name:          TOP_MENU_NAME,
    displayName:   'Export to ODT',
    icon:          'img/icon.svg',
    adminRequired: 0,
  })
  console.log('Registered top menu: ' + TOP_MENU_NAME)

  // Register script for the top menu page
  await ocsPost('/ocs/v2.php/apps/app_api/api/v1/ui/script', {
    type: 'top_menu',
    name: SCRIPT_NAME,
    path: SCRIPT_PATH,
  })
  console.log('Registered script: ' + SCRIPT_NAME)
}

async function unregisterAll() {
  await ocsDelete('/ocs/v2.php/apps/app_api/api/v1/ui/top-menu', { name: TOP_MENU_NAME })
  console.log('Unregistered top menu: ' + TOP_MENU_NAME)

  await ocsDelete('/ocs/v2.php/apps/app_api/api/v1/ui/script', {
    type: 'top_menu',
    name: SCRIPT_NAME,
    path: SCRIPT_PATH,
  })
  console.log('Unregistered script: ' + SCRIPT_NAME)
}

export async function enabled(req, res) {
  const isEnabled = req.query.enabled === '1'
  console.log(`odf-kit-service ${isEnabled ? 'enabled' : 'disabled'}`)

  // Respond 200 first — AppAPI has a 30-second timeout on /enabled
  res.json({ enabled: isEnabled })

  // Register or unregister asynchronously after responding
  if (isEnabled) {
    await registerAll().catch(console.error)
  } else {
    await unregisterAll().catch(console.error)
  }
}
