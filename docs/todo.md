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
