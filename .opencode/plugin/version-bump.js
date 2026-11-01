import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const BASH_TOOL = "bash"
const GIT_COMMIT = /(?:^|[;&|(]|\n)\s*git(?:\s+-C\s+(?:"[^"]*"|'[^']*'|\S+)|\s+-c\s+\S+)*\s+commit\b/
const MESSAGE_ARG = /(?:^|\s)(?:-m|--message)(?:\s*=\s*|\s+)((?:"(?:[^"\\]|\\.)*")|(?:'[^']*')|(?:[^\s;&|]+))/g
const FILE_ARG = /(?:^|\s)(?:-F|--file)(?:\s*=\s*|\s+)((?:"[^"]*")|(?:'[^']*')|(?:\S+))/g

function resolveCwd(root, args) {
  const workdir = args?.workdir
  if (typeof workdir !== "string" || !workdir) return root
  return path.isAbsolute(workdir) ? workdir : path.resolve(root, workdir)
}

function isCommit(command) {
  if (!GIT_COMMIT.test(command)) return false
  if (/--amend\b/.test(command)) return false
  if (/--dry-run\b/.test(command)) return false
  if (/(?:^|\s)(?:-h|--help)\b/.test(command)) return false
  return true
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"')
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  return value
}

function matches(regex, command) {
  const found = []
  for (const match of command.matchAll(regex)) found.push(unquote(match[1]))
  return found
}

function commitMessage(command, cwd) {
  const parts = matches(MESSAGE_ARG, command)
  for (const file of matches(FILE_ARG, command)) {
    try {
      parts.push(fs.readFileSync(path.resolve(cwd, file), "utf8"))
    } catch {}
  }
  return parts.join("\n")
}

function commitType(message) {
  const subject = message.split("\n").find((line) => line.trim()) ?? ""
  if (/BREAKING[ -]CHANGE/.test(message) || /^[^\n:]+!:/m.test(subject)) return "major"
  const type = subject.match(/^\s*([A-Za-z]+)(?:\([^)]*\))?!?:/)
  return type?.[1]?.toLowerCase() === "feat" ? "minor" : "patch"
}

function bumpVersion(version, type) {
  const core = String(version).split("-")[0]
  const parts = core.split(".").map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) return null
  const [major, minor, patch] = parts
  if (type === "major") return `${major + 1}.0.0`
  if (type === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  })
}

function repoRoot(cwd) {
  try {
    return git(cwd, ["rev-parse", "--show-toplevel"]).trim()
  } catch {
    return null
  }
}

function headVersion(repo, file) {
  try {
    return JSON.parse(git(repo, ["show", `HEAD:${file}`])).version ?? null
  } catch {
    return null
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

export default async function versionBump({ directory, worktree }) {
  const root = worktree || directory

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== BASH_TOOL) return
      const command = output?.args?.command
      if (typeof command !== "string" || !isCommit(command)) return

      const cwd = resolveCwd(root, output.args)
      const repo = repoRoot(cwd)
      if (!repo) return

      const packageFile = path.join(repo, "package.json")
      if (!fs.existsSync(packageFile)) return

      let pkg
      try {
        pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"))
      } catch {
        return
      }

      const current = pkg.version
      const previous = headVersion(repo, "package.json")
      const alreadyBumped = previous !== null && previous !== current
      if (!alreadyBumped) {
        const next = bumpVersion(current, commitType(commitMessage(command, cwd)))
        if (!next) return
        pkg.version = next
        writeJson(packageFile, pkg)

        const lockFile = path.join(repo, "package-lock.json")
        if (fs.existsSync(lockFile)) {
          try {
            const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"))
            if (typeof lock.version === "string") lock.version = next
            if (lock.packages?.[""] && typeof lock.packages[""].version === "string") {
              lock.packages[""].version = next
            }
            writeJson(lockFile, lock)
          } catch {}
        }
      }

      try {
        git(repo, ["add", "--", "package.json"])
        if (fs.existsSync(path.join(repo, "package-lock.json"))) {
          git(repo, ["add", "--", "package-lock.json"])
        }
      } catch {}
    }
  }
}
