# TODO

## Shipped 2026-07-17 — Home & Polish round

- Automation research lookups fixed at the root: the permissions grant UI now
  derives its tool dropdown from `TOOL_CATALOG` instead of a stale hardcoded
  list, and the automation editor preflight-warns when the chosen level
  leaves a pipeline's tools ungranted (unattended runs used to auto-deny
  those silently).
- Calendar: 1-day view alongside 7d/14d/month; manual event creation and
  deletion (`events.source = "manual"`) via a quick-add form on the calendar.
- Exo-sphere stays hidden at rest and fades in as the user scrolls out past
  zoom ~0.95, fully visible by ~0.7 — no more clutter from older chats
  crowding the view.
- Agent visualization is back on category chat stars, subtler this time:
  small satellite dots per agent (no tool sub-nodes), with agent chips on
  the hover card.
- New chats and notes inherit the project/category context they're created
  from (sphere drill-in or the active sidebar filter); clicking a project
  star navigates to that project's detail page; double-clicking a chat title
  renames it in place.
- Home is a launcher: a bookmarks strip, quick capture (task or note without
  leaving Home), recent chats, and clickable stat tiles/cards.
- Status bar gained live tappable readouts — tasks due today, next
  automation run — plus the model chip now opens Settings.
- Refresh keeps your place: nav position (page, tab, open chat) persists to
  localStorage, and per-session chat composer drafts survive reload too.
- Tasks tab gained due-window filters (Overdue / Today / This week) that
  compose with the category chips, plus a "show completed" section with
  reopen/delete.

Deliberately not done this round (see plan.md's "Deliberately not done"):
task quick-add drafts aren't persisted — only chat composer drafts are, since
a half-typed chat message is expensive to retype and a task title isn't;
manual events don't get their own `category_id` — they color by kind, and
category filtering of events still flows through the course link.

## Possible future problems (not urgent)

- Bookmarks/snippets don't get their own `category_id` — they already filter
  by group and project, and a project carries its category. Revisit if that
  indirection ever bites.
- No "Uncategorized" drill-in page — unfiled items remain visible in their
  home sections; only the network sphere gets an "unfiled" star.
- Flashcards keep folder scoping (no `category_id`) — the Review-tab move +
  copy fixes the confusion, not a new tagging axis.
