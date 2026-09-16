# AI Agentic Tools Template

A minimal starting point for working with AI coding assistants in a dev container. The container image comes pre-loaded with all tools — this repo only needs the config files to get everything running.

This repo also houses **PRISM LCA**, a minimal clone of [tiangong-lca-next](https://github.com/linancn/tiangong-lca-next)'s sidebar/data-browsing shell (see `plan.md` for the full design). See below for how to run and deploy it.

---

## PRISM LCA

A React + Vite + Supabase app with a collapsible sidebar over 7 "Open Data" types (Models, Processes, Flows, Flow Properties, Unit Groups, Sources, Contacts), backed by one generic `datasets` table.

### Running locally

```
npm install
npm run dev
```

Supabase must be configured (below) before the app will load any data — without it, dataset pages show a "Supabase is not configured" error.

### Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/seed.sql` to create the tables,
   owner-scoped RLS policies, and 77-row public MCP-backed snapshot. Then run
   `supabase/migrations/202609160001_multi_user_import.sql` to install the
   idempotent atomic-import RPC (the migration is also safe to apply to an
   existing deployment).
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key (Project Settings → API):
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
4. Restart `npm run dev` — the app now reads/writes through Supabase, and magic-link sign-in (sidebar footer) becomes usable.

After intentional changes to the live dataset, refresh the checked-in snapshot with:

```
python3 scripts/export_seed.py
```

The exporter reads the public dataset fields using the Supabase URL and anon key from `.env`. Review and commit the resulting `supabase/seed.sql`.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds on every push to `main` and deploys `dist/` to GitHub Pages.

1. In the repo's **Settings → Secrets and variables → Actions**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`) — the workflow needs them at build time since Vite inlines `import.meta.env.*` into the bundle.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Push to `main`; the workflow builds and deploys automatically.

---

## Quick Start

1. Click **"Use this template"** button (top right of this repo)
2. Select **"Create a new repository"**
3. Name your repository and click **"Create repository from template"**
4. Open your new repo in GitHub Codespaces:
   - Click **Code** → **Codespaces** → **Create codespace on main**
5. VS Code will open and the dev container will automatically build
6. The postCreateCommand will run:
   - Set up SSH keys and PATH
   - Install and configure MCP servers
   - Initialize skills infrastructure
   - Install the skill-creator tool
   - Sync all skills to your agents

**That's it!** All AI agents (Claude Code, OpenCode, Copilot, Crush, Gemini, Codex) are ready to use.

---

## What's in the Dev Container

Your container includes:

- **[Claude Code](https://code.claude.com/docs/en/overview)** — AI agentic coding tool from Anthropic
- **[OpenCode](https://github.com/opencode-ai/opencode)** — Open source code-focused AI tool
- **[Copilot](https://github.com/features/copilot)** — GitHub's AI pair programmer
- **[Crush](https://github.com/charmbracelet/crush)** — A beautifully themed assistant for command-line work
- **[Codex](https://github.com/openai/codex)** — OpenAI's agentic tool
- **[Gemini](https://github.com/google-gemini/gemini-cli)** — Google's AI coding assistant

**Configuration managed by:**
- `configs/mcp-servers.conf` — Model Context Protocol servers available to all agents
- `.skillshare/` — Custom skills available to all agents (single source of truth)

---

## Starting the Agents

All launcher scripts live in `permissions/` inside the container (baked into the image). Each one starts its tool with the right flags so you're not interrupted by permission prompts.

### Claude Code

```
# claude.sh
```

Runs `claude` with `IS_SANDBOX=1` and `--dangerously-skip-permissions`. In a dev container this is safe and makes the experience much smoother.

### OpenCode

```
# opencode.sh
```

Permissions are handled by `.opencode/opencode.json`, already configured with `read`, `write`, and `execute` set to `allow`.

### Copilot

```
# copilot.sh
```

Runs `copilot --allow-all`.

### Crush

```
# crush.sh
```

Runs `crush --yolo`.

### Codex

```
# codex.sh
```

Permissions are handled via `.codex/config.toml`, already configured for a sandbox environment.

---

## MCPs (Model Context Protocol Servers)

MCP servers extend AI tools with access to external data and services. All MCP configuration flows from a single file: `configs/mcp-servers.conf`

### Adding Additional MCPs

Edit `configs/mcp-servers.conf` and add entries using this format:

```
# SSE MCP (no authentication):
dolt=https://bus-mgmt-databases.mcp.mathplosion.com/mcp-dolt-database/sse

# HTTP MCP with authentication (credential from environment variable):
# stitch=https://stitch.googleapis.com/mcp|http|X-Goog-Api-Key:$STITCH_API_KEY
```

The `dolt` entry above is already active and provides access to a version-controlled SQL database. To add other authenticated MCPs like Stitch, uncomment the entry and provide the API key via environment variables.

After editing `configs/mcp-servers.conf`, run:

```
# install-mcps.sh
```

This reads the conf file and registers each MCP in all AI tools — Claude, OpenCode, Gemini, Crush, Copilot, and Codex. Safe to re-run; existing entries are replaced with current values.

### For Authenticated MCPs

To use authenticated MCPs like Stitch:

1. Add the secret (e.g., `STITCH_API_KEY`) at [github.com/settings/codespaces](https://github.com/settings/codespaces) under "Repository secrets"
2. Declare the secret in `.devcontainer/devcontainer.json` under `"secrets"` — this works in both GitHub Codespaces and local devcontainers:
   ```json
   "secrets": {
     "STITCH_API_KEY": "STITCH_API_KEY"
   }
   ```
3. Uncomment the MCP entry in `configs/mcp-servers.conf` and reference the secret variable (e.g., `$STITCH_API_KEY`)
4. Run `install-mcps.sh`

### Uninstalling MCPs

```
# uninstall-mcps.sh
```

Removes all MCP registrations listed in the conf file from every tool's config.

---

## Skills (All Agents)

Skills are custom slash commands available across all your AI agents. The `.skillshare/` directory is the **single source of truth** for all skills.

### Editing Skills

**Always edit skills directly in the `.skillshare/` directory.** Never manually edit skills in other tool directories — the `.skillshare/` folder is where skillshare manages your skills. Changes to skills in other locations will be overwritten during sync.

### Installing Skills

Install individual skills using:

```
# skillshare install github.com/anthropics/skills/skill-creator
# skillshare install github.com/your-org/your-skill-name
```

### Syncing Skills to All Agents

After installing or modifying skills in `.skillshare/`, sync them to all your configured AI agents:

```
# sync-skills.sh
```

This deploys skills to the platforms listed in `.skillshare/config.yaml` (Claude Code, OpenCode, Copilot, Gemini, Crush, Codex, etc.).

---

## Optional Add-ons

These scripts are available inside the container:

### Data Science Tools

```
# install-datascience.sh
```

Installs Python data science libraries, Jupyter, Quarto, and TinyTeX. Includes: numpy, pandas, matplotlib, seaborn, requests.

### Dolt Database

```
# install-dolt.sh
```

Installs [Dolt](https://github.com/dolthub/dolt), a version-controlled SQL database.

---

## Container Image

The image is built from [calvinw/ai-agentic-tools](https://github.com/calvinw/ai-agentic-tools) and published to:

```
ghcr.io/calvinw/ai-course-devcontainer:latest
```

It is rebuilt automatically on Dockerfile changes and weekly via GitHub Actions.
