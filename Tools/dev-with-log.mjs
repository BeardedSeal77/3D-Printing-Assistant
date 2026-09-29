// Runs the Next.js dev server and the Flask API side by side.
// Output from each is prefixed and, when DEV_LOG=true in the root .env,
// also appended to temp/dev.log so a file watcher can tail it.

import { spawn } from "node:child_process"
import { existsSync, mkdirSync, createWriteStream, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const frontendDir = join(root, "frontend")
const isWindows = process.platform === "win32"

function readEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const i = line.indexOf("=")
    if (i === -1) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "")
  }
  return out
}

const env = { ...readEnv(join(root, ".env")), ...process.env }
const logEnabled = String(env.DEV_LOG ?? env.WATCHER_ENABLED ?? "").toLowerCase() === "true"

let logStream = null
if (logEnabled) {
  const tempDir = join(root, "temp")
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
  logStream = createWriteStream(join(tempDir, "dev.log"), { flags: "a" })
  logStream.write(`\n===== dev session started ${new Date().toISOString()} =====\n`)
}

const RESTART_DELAY_MS = 1500
const MAX_RAPID_RESTARTS = 5
const RAPID_WINDOW_MS = 10_000

const services = [
  { name: "next", color: "\x1b[36m", script: "next-dev", restart: true },
  { name: "flask", color: "\x1b[32m", script: "flask-dev", restart: true },
]
const reset = "\x1b[0m"
const children = []

function pipe(stream, name, color) {
  let buffer = ""
  stream.on("data", (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      process.stdout.write(`${color}[${name}]${reset} ${line}\n`)
      logStream?.write(`[${name}] ${line}\n`)
    }
  })
}

function startService(svc) {
  const child = spawn("npm", ["run", svc.script], {
    cwd: frontendDir,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  pipe(child.stdout, svc.name, svc.color)
  pipe(child.stderr, svc.name, svc.color)

  if (!svc._restartTimes) svc._restartTimes = []

  child.on("exit", (code) => {
    process.stdout.write(`${svc.color}[${svc.name}]${reset} exited with code ${code}\n`)
    const idx = children.indexOf(child)
    if (idx !== -1) children.splice(idx, 1)

    if (shuttingDown || !svc.restart || code === 0) return

    const now = Date.now()
    svc._restartTimes = svc._restartTimes.filter((t) => now - t < RAPID_WINDOW_MS)
    if (svc._restartTimes.length >= MAX_RAPID_RESTARTS) {
      process.stdout.write(
        `${svc.color}[${svc.name}]${reset} crashed ${MAX_RAPID_RESTARTS} times in ${RAPID_WINDOW_MS / 1000}s, giving up\n`,
      )
      return
    }
    svc._restartTimes.push(now)
    process.stdout.write(
      `${svc.color}[${svc.name}]${reset} restarting in ${RESTART_DELAY_MS / 1000}s...\n`,
    )
    setTimeout(() => {
      if (shuttingDown) return
      startService(svc)
    }, RESTART_DELAY_MS)
  })

  children.push(child)
}

for (const svc of services) {
  startService(svc)
}

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  process.stdout.write("\nStopping services...\n")
  for (const child of children) {
    if (child.exitCode !== null) continue
    if (isWindows) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true })
    } else {
      child.kill("SIGTERM")
    }
  }
  logStream?.end()
  setTimeout(() => process.exit(0), 1500)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
process.on("SIGHUP", shutdown)
