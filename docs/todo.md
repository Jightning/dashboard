# TODO

## UX

- No calendar event *creation* UI — events still come from ICS import;
  tasks/automations/applications remain the user-authored time entries.
- Calendar should also have a 1 day view.
- When chat gets cluttered with a lot of agents, the network sphere looks messy even with the exosphere. The exosphere with older chats should be mostly out of view, with it only appearing after the user wants to scroll out.
- The visualization of the agents associated with a chat has been removed. It needs to be put back in, maybe in a more subtle fashion. This should be fine should the exoskeleton fix get implemented.
- Currently, adding a new chat under a specific project has to be done manually (create the chat, then select the project). This is bad, if the user is in the tab for the project, or has clicked on the project's node, any new chats should auto-go under that project. The same applies to things like notes.
- 

## Features

- Agent automation is unable to perform research look ups, even with a custom permission that asks for none of the options.
- The home menu needs more functionality, for example things like bookmarks should be made more readily accessible (from the home menu), that way they can be accessed without traversing menu through menu. Any other functionality for speed and efficiency is up to you.
- 

## Possible future problems

- Bookmarks/snippets don't get their own `category_id` — they already filter
  by group and project, and a project carries its category. Revisit if that
  indirection ever bites.
- No "Uncategorized" drill-in page — unfiled items remain visible in their
  home sections; only the network sphere gets an "unfiled" star.
- Flashcards keep folder scoping (no `category_id`) — the Review-tab move +
  copy fixes the confusion, not a new tagging axis.
