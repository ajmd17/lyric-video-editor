const express = require('express')
const path = require('path')
const fs = require('fs')
const http = require('http')
const bodyParser = require('body-parser')

const serverConfig = require('./server_config.json')

const app = express()

const HTTPS_ENABLED = false

function createServer() {
  if (HTTPS_ENABLED && process.env.NODE_ENV == 'production') {
    const httpsConfig = {
      ca: fs.readFileSync(path.join(__dirname, serverConfig.SSL_CA)).toString(),
      key: fs.readFileSync(path.join(__dirname, serverConfig.SSL_KEY)).toString(),
      cert: fs.readFileSync(path.join(__dirname, serverConfig.SSL_CERT)).toString()
    }

    return https.createServer(httpsConfig, app)
  } else {
    return http.createServer(app)
  }
}

const server = createServer()

app
.set('views', path.join(__dirname, 'web'))
.use(bodyParser.json({extended: true, limit: '100mb'}))
.use('/cvg', require('./cvg'))
.use('/audio', express.static(path.join(__dirname, 'web', 'audio')))
.use('/css', express.static(path.join(__dirname, 'web', 'css')))
.use('/images', express.static(path.join(__dirname, 'web', 'images')))
.use('/js', express.static(path.join(__dirname, 'web', 'js')))
.use('/js/lib', express.static(path.join(__dirname, 'web', 'js', 'lib')))
.use('/font', express.static(path.join(__dirname, 'web', 'font')))
.use('/example_data', express.static(path.join(__dirname, 'web', 'example_data')))
.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'))
})



function startServer({ port }) {
  server.listen(port)
}

startServer({
  port: 8000
})
