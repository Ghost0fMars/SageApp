// Ce fichier est lancé par Electron avec ELECTRON_RUN_AS_NODE=1
// Il démarre le serveur Next.js standalone en mode Node pur
const path = require('path')

const standaloneDir =
  process.env.IS_PACKAGED === '1'
    ? path.join(process.env.RESOURCES_PATH, 'standalone')
    : path.join(__dirname, '..', '.next', 'standalone')

process.chdir(standaloneDir)
require(path.join(standaloneDir, 'server.js'))
