# FuzePicker — CLAUDE.md (L1 overlay)

This repo **extends** the FuzeSDLC baseline (L0, `CLAUDE.baseline.md` in `izzywdev/FuzeSDLC`, pinned at `baselineRef: main`). The baseline governs everything not restated here; where this file conflicts, this repo wins. Do not duplicate the baseline — only the repo-specific deltas live here.

## Repo identity
- **Tier:** `product`
- **Class:** `oss-public` — public, **MIT** licensed, open contribution / public security disclosure. Do not replace the MIT `LICENSE` with a proprietary one.
- **Expert:** `fuzepicker-expert` — **consult it first** on any task here to load architecture/gotcha context (it advises, it does not own deliverables).
- **Manifest:** `.fuze/manifest.json` declares the instantiated agent subset and hardening settings.

## What this repo is
A **Manifest V3 Chrome extension** (the "AI DOM Element Assistant" — Shadow-DOM-isolated element picker, MV3 service worker, action popup; JS/CSS/HTML, no bundler) plus a **Node/Express + Mongoose/MongoDB + OpenAI** backend API. See `fuzepicker-expert` for the full map and gotchas (MV3 worker lifecycle, Shadow DOM isolation, content-script ↔ background messaging, backend AI fallback).

## Agents
Single-responsibility domain agents live in `.claude/agents/` (subset of the FuzeSDLC canon, per the manifest). Routing, the done-contract, and the verification protocol follow the baseline — each agent reports `SCOPE DONE (verified)` + `OUT OF SCOPE — NOT DONE` and never calls the *feature* done.

## Hardening & delivery
- Hardened per the FuzeSDLC standard (branch ruleset, Harden Gate, signed commits, automation stack, nightly reconciliation) — identical across classes. Do not weaken hardening.
- **`deployOnPush: false`** — this extension/API is not auto-deployed to the cluster on merge. Finish work as a **merged PR**, not just local commits.
- Cross-repo infra changes are delegated to **FuzeInfra via `@claude`** — never operate shared infra from here.
