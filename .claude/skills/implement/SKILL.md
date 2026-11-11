---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

If the ticket has a plan commit, start from it and from its acceptance file (`docs/tickets/<issue>/<ticket>/aceite.md`), and put each criterion ID in a tag of its acceptance test, as the root `AGENTS.md`, section "Plano do ticket", describes. If it has none, stop and ask for `/plan-ticket` first.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

While working, run only the tests tied to the files you changed, with the commands in the project's `AGENTS.md`; the stop hook already runs the type and lint checks.

Once done, call the Skill tool with "simplify" and then with "code-review" to review the work, then call the Skill tool with "revisao-conformidade" to run the conformance review and triage its findings, as that skill describes. Then run the full verification once, before the commit that closes the work, as the root `AGENTS.md`, section "Definição de pronto", describes.

Commit your work to the current branch.
