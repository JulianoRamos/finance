---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph. For each ticket, start from its plan commit and its acceptance file (`docs/tickets/<issue>/<ticket>/aceite.md`), as the root `AGENTS.md`, section "Plano do ticket", describes. If a ticket has no plan commit, stop and ask for `/plan-ticket` first. Every acceptance test carries its criterion ID in a tag.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - runs only the tests tied to the files it changed, and never `scripts/verify.sh full`, which is the main session's;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `simplify` and then with `code-review` on the integration branch. Then call the Skill tool with `revisao-conformidade` once per ticket: each review gets the same diff of the integration branch, in that ticket's folder, with its identifier, plan message and contract drift. Triage each ticket's findings in the main session, as step 5 of that skill says, and fix the issues raised by the code review and the findings you accepted in a single **implementer subagent**. Then, in the main session, run `scripts/verify.sh full` once, before the commit that closes the work, as the root `AGENTS.md`, section "Definição de pronto", describes.

8. If a draft PR exists, publish each ticket's review comment, as the `revisao-conformidade` skill describes in "Publish", and mark the PR ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up all **implementer subagent** worktrees.
