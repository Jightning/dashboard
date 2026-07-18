# TODO

(Items planned in the current `plan.md` round — web-search trust, hourly 1-day
view, paste-text documents, exo-sphere layers, Ollama setup, usage visibility,
draft limits, hosting readiness — have been removed from this list; what
remains is deliberately deferred to a future round.)

## Planner

- Sources & schedules in planner should be moved to its own School tab (or workspace, whatever is best for UX considering not all users go to school, maybe instead a tab named "Schedule") where classes can be managed (each course getting added as it's own projects under an auto managed schools category, with its own files, class schedule that appears on the calendar, and so on).

## Permissions

- There should also be the ability to create "private" instances of things (maybe a category could have the ability to be tagged as private, same thing with notes, tasks, and so on). These private instances shouldn't be read by external things no matter what, only chats/agents that exist within these private instances.

## Agents

- Automations and pipelines should also allow the inclusion of uploaded files into their respective contexts.
- The agents interface should optimize for prompt engineering: work out the best way to automate prompt engineering inside the dashboard — study how the user actually phrases requests (chat history is local and searchable) alongside common prompt-engineering optimizations (role/persona framing, explicit output format, few-shot examples, constraint lists, step decomposition), and propose where the dashboard should apply them automatically (e.g. a "refine my prompt" pass before send, template suggestions in the pipeline editor, or per-agent instruction tune-ups driven by past run quality).

## Home

- Ability to re-arrange the home menu, and to add widgets. This way the home menu can be customized however I'd like (from the user's end).

## Possible future problems (not urgent)

- Bookmarks/snippets don't get their own `category_id` — they already filter
  by group and project, and a project carries its category. Revisit if that
  indirection ever bites.
- No "Uncategorized" drill-in page — unfiled items remain visible in their
  home sections; only the network sphere gets an "unfiled" star.
- Flashcards keep folder scoping (no `category_id`) — the Review-tab move +
  copy fixes the confusion, not a new tagging axis.
