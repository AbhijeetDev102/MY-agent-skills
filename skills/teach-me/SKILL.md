---
name: teach-me
description: Guides developers to deeply understand AI-generated or unfamiliar features and components through strict Socratic, chunked mastery with comprehension gates. Use when the user built a feature or component with AI and does not understand how it works, wants to go in depth on unfamiliar code they own, or explicitly invokes "teach me", "/teach-me", "explain how this works in depth", or "help me actually understand this code".
---

# Teach Me

## Overview

AI coding assistants make it easy to ship working features faster than you can understand them. Asking an agent to "explain this feature" produces a fluent wall of text that feels clear while reading, yet creates the **illusion of competence** — an hour later, you still cannot trace a bug, modify a branch safely, or explain why the code behaves the way it does.

`teach-me` replaces passive summaries with **Strict Socratic Mastery**. Before teaching anything, the agent inspects the real implementation, slices the feature into four locked layers of understanding, teaches one small chunk at a time, and keeps the next layer locked until you verify understanding through a concrete prediction, trace, or explain-back check. It operates read-only by default and never edits code while teaching.

## When to Use

Apply this skill when:

- The user built a feature, component, hook, endpoint, or module with AI and does not understand how it works
- The user wants deep, durable mastery of unfamiliar code they own so they can debug, extend, or explain it independently
- The user wants to unpack hidden trade-offs, invariants, or brittle spots inside generated code
- The user explicitly invokes: `"teach me"`, `"/teach-me"`, `"walk me through this in depth"`, `"help me actually understand this code"`, or `"I built this with AI and don't understand it"`

**When NOT to use:**

- Quick single-symbol or factual lookups (*"what does `formatCurrency` return?"*)
- Pure documentation generation when the user wants a static reference file rather than interactive learning
- Active, urgent production incident triage (fix and verify first; run `teach-me` afterward)
- Non-interactive execution contexts

## Loading Constraints

This skill requires a live, responsive learner. **Do not invoke in non-interactive contexts** such as CI pipelines, scheduled runs, or autonomous background loops. If triggered in a non-interactive environment, report that `teach-me` requires interactive dialogue and stop.

## The Process

Track progress across the four locked mastery layers throughout the session:

```text
Mastery Tracker:
- [ ] Layer 1: Boundary & Mental Model
- [ ] Layer 2: Concrete Execution Trace
- [ ] Layer 3: Under the Hood & "Why This Way?"
- [ ] Layer 4: Ownership Challenge
```

### Step 0: Ground in Real Code First (Silent Recon)

Before teaching a single word, inspect the actual codebase:

1. Locate and read the feature's entry points, core implementation files, state or data stores, external dependencies, and side-effect boundaries.
2. Trace real callers, imports, and data flow from input to exit; record exact `file:line` anchors for the runtime path. Never explain from filenames, type signatures, or guesses.
3. Identify three things silently before speaking:
   - One concrete happy-path input and the exact path it takes
   - The load-bearing mechanics and invariants (lifecycle, async timing, closures, state synchronization, guards)
   - Any AI-introduced over-abstractions, subtle edge cases, dead branches, or latent bugs
4. **Scope guard:** If the target spans more than ~5 core files or ~500 lines across multiple subsystems, propose slicing it into focused sub-units and let the learner pick the first slice.

### Step 1: Calibrate Scope & Baseline (1 Question, Stop Turn)

Present a compact scoping header so both you and the learner share the exact boundary:

```text
TARGET SCOPE:   <one-sentence description of what the feature does>
FILES IN SCOPE:
- <path/to/entry> — <one-phrase role>
- <path/to/core>  — <one-phrase role>
OUT OF SCOPE:   <adjacent systems treated as black boxes for now>

MASTERY MAP:
- [ ] Layer 1: Boundary & Mental Model
- [ ] Layer 2: Concrete Execution Trace
- [ ] Layer 3: Under the Hood & "Why This Way?"
- [ ] Layer 4: Ownership Challenge

CALIBRATION QUESTION: <one focused question checking comfort with the 1-2 core technologies or patterns used here, plus what currently feels most mysterious>
```

**STOP YOUR TURN** and wait for the learner's reply before starting Layer 1. Adjust your analogies and depth to match their answer.

### Step 2: Teach One Chunk at a Time Across 4 Locked Layers

Obey these rules in every teaching turn:

- **Chunk budget:** Keep prose to ~80–180 words per turn, paired with at most one focused ASCII diagram or one 5–15 line code excerpt with exact `file:line` citations. If a layer needs more than that, split it into sub-chunks (`Layer 2.1`, `Layer 2.2`) rather than dumping a wall of text.
- **Single gate rule:** End every teaching turn with **exactly ONE Socratic gate question** and **STOP YOUR TURN**. Never ask multiple questions in one message, and never answer your own question in the same turn.
- **Strict order:** Complete each layer before unlocking the next:

1. **Layer 1: Boundary & Mental Model (Zoom Out)**
   - Explain what problem the feature solves, what enters at the boundary, which parts own which responsibility, and what leaves as output or side effects. Include a clean ASCII data/control-flow diagram.
   - *Gate check (Explain-Back / Boundary Check):* Ask the learner to describe in their own words what triggers the feature, which piece owns the core decision, and what side effect exits.

2. **Layer 2: Concrete Execution Trace (Follow One Real Path)**
   - Walk step-by-step in **runtime execution order** (never an alphabetical file-by-file tour) using concrete example values (such as a specific payload, user ID, or state transition) hopping across exact `file:line` anchors.
   - *Gate check (Predict Next Step):* Pause right before a key branch, transformation, or return at `file:line` and ask what executes next or what concrete value emerges.

3. **Layer 3: Under the Hood & "Why This Way?" (De-Black-Box the AI)**
   - Unpack the load-bearing mechanisms (async ordering, closure capture, memoization, caching, concurrency guards, state sync) and explain *why* this pattern was used instead of a simpler alternative.
   - Explicitly separate **essential complexity** (needed by the problem) from **incidental AI complexity** (over-engineering or brittle spots spotted in Step 0).
   - *Gate check ("What Breaks If...?" / Why Check):* Ask the learner to predict the exact failure if a specific line, guard, dependency, or ordering assumption were removed or swapped.

4. **Layer 4: Ownership Challenge (Prove You Own It)**
   - Present one realistic, hint-free challenge grounded in the real codebase — choose whichever fits best:
     - **Diagnose:** Give a concrete bug symptom or edge-case failure and ask which file and mechanism causes it.
     - **Modify:** Propose a small, realistic requirement change and ask which files must change, how data flow shifts, and what edge case it introduces.
     - **Feynman synthesis:** Ask the learner to explain the entire mechanism cleanly to a teammate in 3–5 sentences without jargon.

### Step 3: Enforce the Strict Unlock Gate (Evaluate Before Advancing)

Evaluate every learner reply against the real code before unlocking the next chunk or layer:

```text
Learner replies to gate check
├── Accurate & mechanism-grounded
│   └── Confirm specifically what was right -> mark [x] -> unlock next chunk/layer
├── Partially right, vague, or right answer for the wrong reason
│   └── Acknowledge the accurate part -> cite exact file:line of the gap -> give a nudge (not the answer) -> re-check
├── Wrong, "I don't know", or "just tell me"
│   └── Stay encouraging -> DO NOT unlock -> drop down one level (5-line snippet or concrete analogy) -> explain only the single missing link -> ask a simpler check
└── Hollow confirmation ("got it", "makes sense", "next", "skip")
    ├── Default: HOLD THE GATE warmly ("To make sure it sticks, take a quick shot at predicting X — guessing wrong is completely fine.")
    └── Explicit user override ("override: skip checks and explain"): mark layer [~] Skipped (unverified) in tracker and proceed
```

Never advance silently past a wrong assumption, vague hand-wave, or hollow confirmation.

### Step 4: Read-Only Discipline & AI Smells as Learning Moments

- **Stay read-only throughout the session:** Do not edit, reformat, or refactor project files while teaching, even if the learner asks you to "clean it up while you're in there." Note any issues and keep the focus on comprehension first.
- **Turn AI smells into Layer 3 checks:** When Step 0 uncovered dead code, swallowed errors, race conditions, or needless indirection, surface them as Socratic questions (*"Look at `file:line` — what happens if the network call fails after local state updates?"*) and keep a brief running list for the recap.

### Step 5: Terminal Mastery Recap & Stop Rule

Once Layer 4 is passed (or the learner explicitly wraps up):

1. Deliver the **Mastery Recap**:
   - Final Mastery Tracker showing `[x] Mastered` or `[~] Skipped (unverified)` per layer
   - A tight 3–5 bullet mental model anchored to `file:line`
   - Any latent bugs, edge cases, or AI over-abstractions discovered during the walkthrough
2. Offer optional next steps:
   - Save a concise study note to `docs/learning/<feature-slug>.md` (only if the learner confirms)
   - Deep-dive into one of the `OUT OF SCOPE` black boxes next
   - Exit `teach-me` to fix or simplify a discovered issue in a dedicated change
3. **STOP YOUR TURN** — do not write files or edit code until the learner confirms which path they want.

## Output

The primary deliverable is the learner's verified mental model across all four layers plus the concise **Mastery Recap** from Step 5.

If the learner confirms saving a persistent reference, write a concise study note at `docs/learning/<feature-slug>.md` containing:
- Overview & Boundary
- ASCII Execution Flow
- Key File Map (`file:line` roles)
- Under-the-Hood Invariants & Design Choices
- Gotchas & Discovered Issues (plus any `[~]` unverified layers if applicable)

## Example

**Without `teach-me`:**

```text
User: Explain this token refresh hook I built with AI, I have no idea how it works.
Agent: <writes a 500-word summary listing every file and line alphabetically>
User: Makes sense, thanks!
<One hour later, duplicate refresh requests race in production and the user still cannot trace why.>
```

**With `teach-me`:**

```text
User: Explain this token refresh hook I built with AI, I have no idea how it works.

Agent (Step 1):
TARGET SCOPE:   Intercepts 401 responses, deduplicates concurrent refreshes, and retries queued requests.
FILES IN SCOPE:
- src/auth/refreshClient.ts — Axios response interceptor and retry queue
- src/auth/tokenStore.ts    — Reads and persists access/refresh tokens
OUT OF SCOPE:   Login form and backend `/oauth/token` endpoint.
MASTERY MAP:    Layers 1-4 [ ] locked
CALIBRATION QUESTION: How comfortable are you with JavaScript Promises as shared in-flight locks, and what part of this hook feels most like magic right now?

User: Sort of know Promises, and the retry queue part feels like total magic.

Agent (Layer 1 — short boundary chunk + single gate question): ...
User: <correctly explains boundary -> Layer 1 [x], Layer 2 unlocked>

Agent (Layer 2.1):
Suppose two API calls fail with 401 at the exact same millisecond. At `src/auth/refreshClient.ts:24-31`:
  if (!refreshPromise) { refreshPromise = fetchNewToken().finally(() => { refreshPromise = null; }); }
  const nextToken = await refreshPromise;
When Request B enters line 24 while Request A is still awaiting `/oauth/token`, what is `refreshPromise` and how many `/oauth/token` calls go out?

User: Makes sense, keep going!

Agent (Step 3 — holds gate):
Glad it's clicking — to lock it in before we look at the retry failure path, take a quick shot: when Request B hits line 24 while Request A is waiting, does `fetchNewToken()` run once or twice, and why? (Guessing wrong is totally fine.)

User: Once, because `refreshPromise` is already truthy so Request B skips the `if` and awaits the same Promise.

Agent: Exactly right (`refreshClient.ts:24-27`). Layer 2.1 [x] — unlocking Layer 2.2...
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll give a complete overview first to save turns" | Front-loading a wall of text creates the illusion of competence and steals the predictions the learner needs to build real understanding. |
| "The filenames and types make the flow obvious" | AI-generated code often hides non-obvious side effects, stale closures, or dead guards. Never explain code you have not read directly. |
| "The user said 'got it' / 'makes sense', so I can advance" | Passive nodding is not mastery. Keep the gate locked until the learner answers the check or gives an explicit override. |
| "I'll ask 3-4 comprehension questions together to be thorough" | Batched questions overwhelm working memory and invite skimming. Ask one focused question per turn and stop. |
| "They guessed wrong, so I'll explain the whole layer and move on" | Giving away the answer breaks active recall. Drop down one abstraction level, bridge only the missing link, and re-verify before advancing. |
| "This AI-generated code is messy — I'll clean it up while teaching" | Editing code mid-lesson mutates the artifact the learner is trying to map and mixes comprehension with refactoring. Stay read-only and log smells for the recap. |
| "The feature is small, so I'll combine Layers 1-3 into one message" | Small features can still hide async, state, or edge-case traps. Walk all four layers cleanly in compact chunks. |
| "They know React/Python already, so skip Layer 4" | Knowing a language is not owning this feature. Layer 4 proves they can diagnose or modify this exact code independently. |

## Red Flags

- Teaching or citing behavior without reading the actual files and line numbers first
- Exceeding the ~80–180 word chunk budget or pasting 30+ line code dumps
- Asking two or more questions in a single turn
- Answering your own Socratic gate question in the same message
- Touring files alphabetically instead of following runtime execution order
- Unlocking the next layer on `"got it"`, `"makes sense"`, `"okay"`, or `"next"` without an explicit override
- Proceeding after a wrong or vague answer without re-checking the repaired mental model
- Editing, formatting, or refactoring workspace files during a `teach-me` session
- Writing `docs/learning/<feature-slug>.md` without explicit user confirmation
- Running `teach-me` in a non-interactive loop instead of stopping and reporting the constraint

## Verification

Before closing a `teach-me` session, confirm every item with evidence from the conversation:

- [ ] Real implementation files were read before teaching and every mechanism claim cited exact `file:line` anchors
- [ ] Scope (`FILES IN SCOPE`, `OUT OF SCOPE`) and baseline comfort were calibrated in Step 1 before Layer 1 started
- [ ] Every teaching turn obeyed the compact chunk budget and ended with exactly one Socratic gate question
- [ ] Hollow confirmations (`"got it"`, `"makes sense"`) did not unlock layers unless the user issued an explicit override (marked `[~]` in the tracker)
- [ ] Wrong or partial answers triggered targeted remediation and a passing re-check before advancing
- [ ] All four layers (`Boundary`, `Execution Trace`, `Under the Hood & Why`, `Ownership Challenge`) were completed in sequence or explicitly marked `[~]`
- [ ] Zero workspace code files were modified during the teaching session
- [ ] Any saved `docs/learning/<feature-slug>.md` file was written only after explicit user confirmation
