import { createServer, get } from 'http'
import { opendir } from 'fs/promises'
import { createReadStream } from 'fs'
import { resolve } from 'path'
import { pipeline as _pipeline } from 'stream'
import { createHash } from 'crypto'
import { promisify } from 'util'

const pipeline = promisify(_pipeline)

async function hashFile (path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest().toString('hex').substr(0, 10)
}

async function scanDir (path, out, depth) {
  const dir = await opendir(path)
  for await (const ent of dir) {
    if (ent.name.startsWith('.')) { continue }
    const entityPath = resolve(dir.path, ent.name)
    const icon = ent.isDirectory() ? '+' : '-'
    const hash = ent.isFile()
      ? ` (${await hashFile(entityPath)})`
      : ''
    out.write(`${' '.repeat(depth)}${icon} ${ent.name}${hash}`)
    if (ent.isDirectory()) { await scanDir(entityPath, out, depth + 2) }
  }
}

// Question to consider: Why aren't we using an async function here?
const server = createServer((request, response) => {
  scanDir(resolve('../..'), response, 0)
    .then(() => response.end())
    .catch((err) => {
      console.error(err)
      response.statusCode = 500
      response.end(err.message)
    })
})

server.listen(3000, () => {
  const port = server.address().port

  get(`http://localhost:${port}`, (response) => {
    response.setEncoding('utf8')
    response.on('data', console.log)
    response.on('end', () => server.close())
  })
})
