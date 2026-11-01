import path from "node:path"

const DIAGRAMS_BY_SOURCE = {
  "src/world/Bounds.ts": ["docs/features/03-widen-play-area.md"],
  "src/core/Renderer.ts": ["docs/features/04-camera-follow.md"],
  "src/entities/Boat.js": [
    "docs/features/08-oar-auto-aim.md",
    "docs/features/09-man-overboard.md"
  ],
  "src/entities/Birds.js": [
    "docs/features/10-flying-birds.md",
    "docs/features/11-storks.md",
    "docs/features/34-sprite-viewer.md"
  ],
  "src/dev/SpriteViewer.js": ["docs/features/34-sprite-viewer.md"],
  "src/dev/sprites.js": ["docs/features/34-sprite-viewer.md"],
  "src/config/tuning.ts": ["docs/features/34-sprite-viewer.md"],
  "src/entities/WildlifeManager.js": ["docs/features/11-storks.md"],
  "src/config/ranking.ts": ["docs/features/12-ranking.md"],
  "src/config/difficulty.ts": ["docs/features/12-ranking.md"],
  "src/systems/RankSystem.ts": ["docs/features/12-ranking.md"],
  "src/entities/SmugglerManager.js": ["docs/features/12-ranking.md"],
  "src/main.js": [
    "docs/features/08-oar-auto-aim.md",
    "docs/features/09-man-overboard.md",
    "docs/features/10-flying-birds.md",
    "docs/features/11-storks.md",
    "docs/features/12-ranking.md",
    "docs/features/34-sprite-viewer.md"
  ]
}

const EDIT_TOOLS = new Set(["edit", "write", "patch", "multiedit", "apply_patch"])
const IDLE_FALLBACK_MS = 30000

function relativeTo(root, file) {
  const normalized = file.replace(/\\/g, "/")
  const relative = path.isAbsolute(normalized) ? path.relative(root, normalized) : normalized
  return relative.replace(/^\.\//, "")
}

function editedFile(args) {
  if (!args || typeof args !== "object") return null
  const file = args.filePath ?? args.path ?? args.file ?? args.filename
  return typeof file === "string" ? file : null
}

export default async function diagramSync({ client, directory, worktree }) {
  const root = worktree || directory
  const pending = new Map()
  const fallbackTimers = new Map()

  function schedule(sessionID) {
    const existing = fallbackTimers.get(sessionID)
    if (existing) clearTimeout(existing)
    fallbackTimers.set(
      sessionID,
      setTimeout(() => {
        flush(sessionID).catch(() => {})
      }, IDLE_FALLBACK_MS)
    )
  }

  function track(sessionID, file) {
    if (!sessionID || !file) return
    const relative = relativeTo(root, file)
    const diagrams = DIAGRAMS_BY_SOURCE[relative]
    if (!diagrams) return

    let tracked = pending.get(sessionID)
    if (!tracked) {
      tracked = new Map()
      pending.set(sessionID, tracked)
    }

    for (const diagram of diagrams) {
      if (!tracked.has(diagram)) tracked.set(diagram, new Set())
      tracked.get(diagram).add(relative)
    }

    schedule(sessionID)
  }

  async function flush(sessionID) {
    const tracked = pending.get(sessionID)
    const timer = fallbackTimers.get(sessionID)
    if (timer) {
      clearTimeout(timer)
      fallbackTimers.delete(sessionID)
    }
    if (!tracked || tracked.size === 0) return

    pending.delete(sessionID)

    const lines = []
    for (const [diagram, sources] of tracked) {
      lines.push(`- ${diagram} <- ${[...sources].join(", ")}`)
    }

    const text = [
      "Feature diagram update requested by the project-local diagram-sync hook.",
      "",
      "These feature logic diagrams are stale because their tracked source files changed:",
      ...lines,
      "",
      "Read the changed source files and update only the Mermaid diagram and its short logic notes in the listed docs. Keep the rest of each file intact. Do not modify game source files."
    ].join("\n")

    try {
      await client.session.promptAsync({
        path: { id: sessionID },
        query: { directory: root },
        body: { parts: [{ type: "text", text }] }
      })
      await client.tui
        .showToast({
          query: { directory: root },
          body: {
            title: "Feature diagrams",
            message: `Queued refresh for ${tracked.size} diagram(s)`,
            variant: "info",
            duration: 3000
          }
        })
        .catch(() => {})
    } catch {
      pending.set(sessionID, tracked)
      schedule(sessionID)
    }
  }

  return {
    "tool.execute.after": async (input) => {
      if (!EDIT_TOOLS.has(input.tool)) return
      const file = editedFile(input.args)
      track(input.sessionID, file)
    },
    event: async ({ event }) => {
      if (event.type !== "session.idle") return
      await flush(event.properties.sessionID).catch(() => {})
    }
  }
}
