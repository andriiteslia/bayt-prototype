# Bayt — "Describe your next home"

A clickable, mobile-first prototype for a property marketplace. A renter describes their next home in their own words, the app shows **what it understood and how sure it is**, the renter corrects it in a tap, and the app returns a **short, explained shortlist**.

> Fictional data only: no real listings, agents or Property Finder content. Typed requests are read by a live model (Claude Haiku) through a serverless function. The API key stays on the server.

**Live prototype:** `https://<project>.vercel.app` On a laptop, the design notes sit next to the phone. On a phone, tap **Design notes**.

---

## 1. Problem framing

### Persona — the newcomer
**Anna, 32, product manager, relocating from London in March.** New job in DIFC. Moving with her partner and a medium-sized dog. Has never lived in Dubai.

Assumptions I'm designing for:

| Assumption | Why it matters for the design |
|---|---|
| She knows her **life** (work in DIFC, dog, wants quiet), not the **map** (doesn't know JLT from JVC) | The AI must translate needs into areas, and explain areas in plain words |
| Budget is set by her relocation package (~AED 130–150k/yr) but she doesn't know what that buys | We must say early when a request is unrealistic, not after 0 results |
| She will act on a shortlist from abroad, without visiting first | Trust is the bottleneck: every claim needs a source, and unknowns must be visible |
| She's unsure about car vs metro | Commute must be a **range with assumptions** (time of day, mode), not one optimistic number |
| She's on her phone, often in short sessions | Mobile patterns, editable state, nothing long to type twice |

**Why this persona:** the gap between how she speaks and how filters work is the widest. A Dubai resident can type "JLT, 2BR, 120k". Anna can't. So AI adds the most value here, and trust is hardest to earn, which is exactly what the brief evaluates.

### What I narrowed on purpose
The job: **from a vague description to a shortlist of ≤5 homes she'd feel safe contacting.**

In scope: describing, understanding, correcting, clarifying, the shortlist, "why this home" and "what we couldn't check".
Out of scope (besides the brief's list): maps, viewing booking, chat with agents, neighbourhood guides beyond one-line area intros.

---

## 2. AI interaction design — principles

1. **The understanding is the product.** After every request the user sees a structured read-back, not a chat bubble. Each item is a chip they can tap.
2. **Three levels of certainty, always visible.**
   - **You said** (solid) — taken directly from her words. "2 bedrooms", "under AED 140k".
   - **I assumed** (dashed) — inferred, with the reasoning one tap away. "Quiet → away from nightlife and highways".
   - **Can't check** (grey) — needs we heard but have no reliable data for. "Nice neighbours", "safe". We say so instead of faking it.
3. **Must-have vs nice-to-have.** Every criterion has a weight the user can flip. Must-haves filter; nice-to-haves rank. This is how one sentence becomes both a filter and a ranking without the user learning either concept.
4. **Correct in place, or in words.** Tap a chip to edit / remove / change weight, or type a refinement ("actually 3 bedrooms", "closer to the metro"). Both update the same understanding.
5. **Ask only what changes the result.** If the description lacks something that would change the list a lot (budget, bedrooms, how she gets to work), the app asks ≤3 quick, tappable questions — always skippable.
6. **Every result explains itself — including the bad parts.** Each card shows what matches, what's partial, and what's unknown. "Pets: not stated by agent — ask before viewing."
7. **Facts have a source.** "Listed by agent" vs "Estimated by Bayt" (e.g., commute, quietness). The model never writes listing facts; it only maps intent to our data.

## 3. Flow

```
Describe ──► Understanding (+ up to 3 quick questions) ──► Shortlist ──► Home detail ──► Saved
   ▲                │  tap chip to edit / type to refine          │
   └────────────────┴──────────────────────────────────────────────┘  "Not for me → why" also refines
```

## 4. Edge cases designed (4 in depth)

| Scenario | Try typing | What the prototype does |
|---|---|---|
| **Vague newcomer** | "Moving from London in March, work in DIFC, don't know the city" | Doesn't guess a budget. Asks 3 skippable questions (budget, bedrooms, car or metro), then shows areas explained in plain words |
| **Conflicting / unrealistic** | "3 bedroom in Downtown under 90k" | Says the combination doesn't exist in the data and offers trade-offs, each with a real result count: raise budget / 2 bedrooms / other areas |
| **Zero results** | Any over-constrained request | Shows which must-have to relax and how many homes that unlocks — never an empty screen |
| **Unverifiable & sensitive** | "Safe area with nice neighbours, no families with kids" | Keeps what it can use, marks "safe / nice neighbours" as *can't check*, and declines filtering by who lives in a building — offering what it *can* do (quiet, low-traffic) |

Handled lightly: out-of-scope ("buy", "mortgage") → short redirect; nonsense input → asks to rephrase with examples.

## 5. How the AI part works, and what I changed in the brief
- **Live model, deterministic fallback.** `api/interpret.js` calls Claude with forced tool use and a strict schema. The model decides only *what the renter meant*. `src/lib/normalize.js` checks the output on the server:
  - unknown fields and areas are dropped;
  - quotes must be the renter's actual words;
  - a "you said" with no matching words is downgraded to "I assumed";
  - labels and units are ours.

  If the model times out (8 s), errors or fails validation, the client uses the scripted interpreter, which returns the same shape. The screen then says **Basic reading**, so the fallback is never hidden.
- **Guided examples use a fixed reading.** This keeps the edge cases the same for every reviewer. Anything you type goes to the live model and shows **Read by AI in X s**.
- **Refinements** send the current reading plus the new sentence. The model returns the full updated reading and a list of changes. Each change can be undone.
- **Words ↔ Filters.** The same reading shown as a familiar filter form. It shows which wishes have no filter on a typical portal, so it proves the "faster than filters" claim instead of just stating it.

## 6. Production thinking

**Architecture.** One LLM call with a strict JSON schema (`criteria[]: {field, value, certainty, quote, rationale}`, `questions[]`, `unsupported[]`). Matching, ranking and every fact on a card come from our search index, never from the model. Commute = routing API at a chosen time of day, cached per area/building.

**Latency.** Target: understanding visible < 1.5s. Stream chips as they're parsed; run search in parallel with the read-back; refinements are diffs to the existing state, not a new conversation.

**Cost.** ~1–2k tokens per interpretation on a small, fast model → fractions of a cent per search. Cache common phrases ("near the metro", "quiet") and area intros. Use a larger model only for ambiguous input.

**Data quality — the real risk.** Pet policy, furnishing, noise and availability are often missing or stale in listings. The design assumes gaps exist and shows them; production needs listing-completeness nudges for agents and freshness flags.

**Risks.** Hallucinated facts (mitigated: model never generates listing data) · Discriminatory filtering (explicit refusal + policy list) · Over-trust in estimates (ranges, labels, "ask the agent" prompts) · Silent misreading (the read-back is mandatory, not hidden).

## 7. Test plan

**Week 1 — moderated, 6–8 people relocating to Dubai within 6 months (remote, their own phones).**
Tasks: describe your next home in your words; fix something it got wrong; pick 2 homes you'd contact and say why.
Watch for: do they read the understanding card? Do they get the difference between *said / assumed / can't check*? Do they correct by tapping or by typing? What makes them not trust a result?

**Then — limited live test vs filters (A/B).**
- Primary: share of sessions that reach a contacted listing; time to first contact.
- Understanding quality: % of chips edited or removed (high = we misread; zero = nobody looks — both are signals).
- Trust: post-contact "was this listing what you expected?"; agent-reported mismatch rate.
- Guardrails: zero-result rate, refinement loops > 3, latency p95, cost per session.

## 8. Not done / next
Map view of the shortlist · real commute ranges by hour · Arabic + RTL · voice input · comparing two homes side by side · memory across sessions ("same as last time, but closer to school").

---

## Run locally
```bash
npm install
npm run dev          # UI only; typed requests fall back to the basic reading
npx vercel dev       # UI + /api with your ANTHROPIC_API_KEY in .env.local
```

## Deploy (Vercel)
1. Import the GitHub repo in Vercel. It detects Vite on its own.
2. Settings → Environment Variables → `ANTHROPIC_API_KEY`. Optional: `ANTHROPIC_MODEL` (defaults to `claude-haiku-5-5`).
3. Set a monthly spend limit in the Anthropic console. The function also caps input at 500 characters and rate-limits each IP on a best-effort basis.

Every push to `main` redeploys.

## Project map
- `api/interpret.js` — serverless function: prompt, schema, timeout, rate limit
- `src/lib/normalize.js` — server-side checks on what the model returns
- `src/lib/interpret.js` — scripted interpreter, used as the fallback and for the guided examples
- `src/lib/match.js` — matching and ranking against listing data (no AI)
- `src/data/notes.js` — the design notes shown next to the prototype
