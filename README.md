# My Agent Skills

Personal collection of agent skills modeled on [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) and the open [Agent Skills specification](https://agentskills.io).

## Skill Catalog

| Skill | Command | Description | Example Triggers |
|---|---|---|---|
| [`teach-me`](skills/teach-me/SKILL.md) | `/teach-me` | Strict Socratic, chunked mastery workflow for deeply understanding AI-generated or unfamiliar features and components before modifying them | `"teach me how this auth hook works"`, `"/teach-me src/checkout"`, `"I built this with AI and don't understand it"` |

## How `teach-me` Works

Instead of dumping a passive summary that fades an hour later, `teach-me` reads the real implementation first and guides you through four locked layers:

1. **Boundary & Mental Model** — Inputs, outputs, ownership boundaries, and an ASCII flow diagram.
2. **Concrete Execution Trace** — Runtime execution order with real values and `file:line` citations.
3. **Under the Hood & "Why This Way?"** — Load-bearing mechanics, design trade-offs, and AI-introduced complexity or brittle spots.
4. **Ownership Challenge** — A hint-free diagnosis, small modification plan, or Feynman explanation to prove you own the code.

Each layer stays locked until you pass a quick check (predicting behavior, tracing a value, or explaining a mechanism back). The session stays read-only unless you explicitly choose to exit and make changes afterward.

## Installing / Using These Skills

### Antigravity

- **Project-local:** copy `skills/teach-me/` into `.agents/skills/teach-me/` inside your target repository.
- **Global (all workspaces):** copy `skills/teach-me/` into `~/.gemini/config/skills/teach-me/`.

### Claude Code

Copy `skills/teach-me/` into `.claude/skills/teach-me/` (project-local) or `~/.claude/skills/teach-me/` (global).

### Cursor

Copy `skills/teach-me/` into `.cursor/skills/teach-me/` (project-local) or `~/.cursor/skills/teach-me/` (global).

### Gemini CLI

Copy `skills/teach-me/` into `.gemini/skills/teach-me/` and optionally copy `commands/teach-me.toml` into `~/.gemini/commands/teach-me.toml` to enable `/teach-me`.

## Validation

Run the local skill validator (requires Node.js):

```bash
node scripts/validate-skills.js
```

## Checklist for Adding New Skills

- Create `skills/<kebab-case-name>/SKILL.md` (under 500 lines) with valid `name` and `description` frontmatter (`Use when ...` positive trigger, `<= 1024` chars, spec-only top-level keys).
- Include the core sections: `## Overview`, `## When to Use`, `## The Process`, `## Common Rationalizations`, `## Red Flags`, and `## Verification`.
- Keep instructions model-neutral (describe capabilities, not host-specific tool names) and avoid empty subdirectories.
- Add trigger and behavioral eval cases at `evals/cases/<kebab-case-name>.json` (`>= 3` positive triggers, `>= 2` negative triggers, `>= 1` behavioral eval).
- Add a matching slash command prompt at `commands/<kebab-case-name>.toml` if needed, and verify everything passes `node scripts/validate-skills.js`.
