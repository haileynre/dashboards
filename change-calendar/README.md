# Change calendar

A day-by-day log of Cursor work for the New Reach team: which platform changed,
what the change was, and the likely downstream impact.

## Open it

Double-click `index.html`. It is static — no build step, no server, no login.
The page reads `changes.js` from the same folder.

## What is logged

October 27 through November 2, 2026, from Cursor chats in this workspace. That
is the last seven days as of November 2. No other Cursor project had a chat in
that window.

- Live means a platform was actually changed.
- Draft means the work exists and is not switched on.
- Reviewed means the session checked something and did not write to a platform.
- Impact notes are inferred. Each one stays on **Needs review** until it is
  approved. Approve on the page saves in that browser only. To make it stick
  for everyone, set `decision` to `"approved"` and `needsReview` to `false`.
  Reject sets `decision` to `"rejected"`. The page hides rejected rows.
- **What actually happened** is a note on each entry for work finished by hand.
  Typing saves in that browser. To keep it for everyone, set `actualImpact` on
  the row.

Stopped or rejected work is left off the calendar. For this first week that
includes the lead-magnet SMS edit (October 28, never finished), the ClickFunnels
thank-you URL swap (planned only), the EventPack tool proxy (offered, not
added), and a Zapier NextGen remake on November 2 (started, not saved).

## Adding a day

When asked for the day's update, append rows to `window.CHANGE_LOG` in
`changes.js`. One row per change. Required fields:

| Field | Example |
|---|---|
| `id` | `2026-11-03-short-name` |
| `date` | `2026-11-03` |
| `platforms` | `["n8n", "Close"]` |
| `brand` | `Subto` |
| `status` | `live`, `draft`, `reviewed`, or `repo` |
| `title` | Short, specific |
| `change` | What was done, with counts |
| `impacts` | Inferred downstream effect |
| `actualImpact` | What actually happened, including hand-finished work. Optional |
| `needsReview` | `true` until confirmed |
| `links` | `{ label, href }` or `[]` |

Do not log member names, emails, or secrets. Staff names are fine when they
are who received the assignment.
