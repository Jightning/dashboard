# TODO

## UI

- [x] "Issue a directive" chat input is offset within the div (the placeholder is slightly higher than the other buttons, like the submit button)
- [x] The stars look too simplistic (just two lines), but also too intrusive (lines are too obvious), make them more intuitive, creative, and subtle.

## UX

- [x] Duplicate "Ask Everything" permissions appear in the dropdown.
- [x] Chat should be a part of the agents section
- [x] **Overhaul:** Unify parts of the UI so things like applications and notes aren't separate (so maybe a calendar section, notes section which includes bookmarks, and agents section with the chat included)
- [x] Having courses out of the box feels too student targeted, this should be a general app for a wide range of users. The courses section should still exist though, maybe as a part of the calendar section mentioned above.
- [x] Agents section is too confusing for a general user. It needs to be made more comprehensive, especially the pipelines ({{input}} syntax is confusing)
- [x] The Neural Net visualization doesn't seem to scale for a ton of chats. With project categorization it would scale better, but still not enough, find a way to either add layers (older chats hidden in the outskirts of the net), make the net auto expand, or whatever is optimal ux/ui wise.

## Features

- [x] Ability to customize certain sections (like chats - allowing renaming, recoloring, etc., notes, )
- [x] Ability to setup projects (within a projects UI) where users can upload files, setup project-exclusive chats, and automations. Projects should also appear as their own "star" or neural net (with files and extra context appearing in the center). Projects could also act as categories in sections like the bookmarks if the user wants (unless it's better to have projects be different from categories, in which case maybe there could be project-unique bookmarks in the projects UI).
- [x] Ability to filter by category in areas like bookmarks, snippets, tasks, ect.

## Follow-ups

- Project stars don't navigate on click yet (hover only explains them) — revisit if it feels dead in practice.
- `notes.project_id` (project-scoped notes) was deliberately skipped as YAGNI; add if project detail pages need it.

## 2026-07-17 — Categories & Signal plan

Shipped (branch `feat/categories-signal`, Tasks 1-13):

- [x] Categories are now first-class: `categories` table, `category_id` on
      projects/tasks/notes/chat_sessions/courses, migration backfills existing
      courses into categories. Projects section renamed to Categories
      (CategoriesPage + CategoryDetail with Projects/Chats/Tasks/Notes tabs);
      ProjectDetail unchanged, opened from a category.
- [x] Planner opens on a calendar first (7d/14d/month views, unified
      tasks+events+automations+application follow-ups via
      `planner/calendarItems.ts`); tasks filter by category.
- [x] Review (flashcards) moved from Planner into Notes, with a
      "make flashcards" button per note (`src/ai/notes/flashcardGen.ts`);
      notes gained categories.
- [x] Real web access: `search_web` tool (DuckDuckGo HTML endpoint, $0) plus
      `fetch_url`, both on the builtin Research agent; a Vite `/__proxy`
      dev/preview middleware unblocks CORS for the browser target
      (desktop already had it via plugin-http).
- [x] Pipeline `{{token}}` editor replaced with an overlay pill editor
      (`TemplateEditor`) shared by pipelines and automations; a starter
      template gallery (`src/ai/pipelines/templates.ts`) and save-run-to-note.
- [x] Chat sessions get router-model auto-title/summary/tags
      (`src/ai/chat/metadata.ts`); sidebar gained search (FTS5 over message
      text + tags/title), category filter, and file-to-category/project
      selects.
- [x] Universe network splits into per-category spheres with an exo-shell
      layer for archive/overflow chats and wheel zoom
      (`buildCategoryUniverse`, `shell` field in `networkData.ts`).

Deliberately not done this round (carried forward from `plan.md`, YAGNI):

- Bookmarks/snippets don't get their own `category_id` — they already filter
  by group and project, and a project carries its category. Revisit if that
  indirection ever bites.
- No "Uncategorized" drill-in page — unfiled items remain visible in their
  home sections; only the network sphere gets an "unfiled" star.
- Flashcards keep folder scoping (no `category_id`) — the Review-tab move +
  copy fixes the confusion, not a new tagging axis.
- No calendar event *creation* UI — events still come from ICS import;
  tasks/automations/applications remain the user-authored time entries.
