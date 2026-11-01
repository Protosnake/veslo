# Project Rules

- Do not validate visual or gameplay changes with Playwright, Puppeteer, or headless browser screenshots. The user runs the game continuously and will report anything that looks wrong.
- Feature tracking: whenever you implement a feature, add it to `features.md` and mark it `Done` (or `In progress` if partial, `TODO` if untouched) in the same change. Do this before reporting the task complete.
- Logic diagrams: implemented features have Mermaid diagrams in `docs/features/`. When you change a tracked source file, keep its linked diagram in sync. The project-local hook in `.opencode/plugin/diagram-sync.js` queues the refresh.
- Keep opencode hooks, plugins, commands, and skills project-local under `.opencode/` so they ship with this repo; do not move project-specific hooks into global config.
- Versioning: `.opencode/plugin/version-bump.js` bumps `package.json` and `package-lock.json` before every agent-run `git commit` using the conventional-commit type (`feat:` minor, `fix:`/other patch, `BREAKING CHANGE`/`!` major) and stages both files. Do not bump the version manually.
