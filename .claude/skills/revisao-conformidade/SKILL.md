---
name: revisao-conformidade
description: "Run the conformance review of a change that alters code in apps/: prepare its inputs with scripts/verify.sh review, call the revisor-conformidade subagent with paths only, record and triage the findings, then publish them as a PR comment. Use after /code-review and before scripts/verify.sh full, and again when the pull request is opened."
---

How to run the conformance review that the root `AGENTS.md` requires, and what to do with its result. The rule (who reviews, when, and that the review does not block) is in that file, section "Revisão de conformidade"; what the `revisor-conformidade` subagent checks is in the root `REVIEW.md` and in `.claude/agents/revisor-conformidade.md`.

The skill has two parts, at two moments: **Review**, after `/code-review` and before the `full`, so the fixes go into the single full verification; and **Publish**, when the pull request exists, which may be in another session.

## Review

1. **Folder.** With a ticket, the review lives in the ticket's folder, `docs/tickets/<pai>/<ticket>/`, next to its acceptance file. Without a ticket, it lives in `docs/tickets/sem-ticket/<nome>/`, with a short lowercase name you choose (letters, digits and hyphens). Without a ticket, first write the acceptance criteria of the change in `criterios.md` in that folder, one numbered criterion per line, from what was asked and not from what was done. The script refuses to run without it.

2. **Inputs.** From the repository root, run:

   ```bash
   scripts/verify.sh review <pai> <ticket>     # with a ticket
   scripts/verify.sh review sem-ticket <nome>  # without one
   ```

   It writes, in the folder, `review.diff` (everything the branch changed since it left the base, up to the working tree, with every new file Git does not ignore) and, with a ticket, `plano.txt` (the plan commit message) and `contract-drift.txt` (the contract and schema drift since the plan commit, always written), and it prints the path of the ticket's visual reference (`referencia/`, the prototype screens the plan downloaded) when there is one. It fails, and says what to do, when the ticket has no plan commit, when `criterios.md` is missing, when the inputs would not be ignored by Git, or, with a ticket, when the `api` container is down. The base is `origin/main`; for a pull request to another base, set `HARNESS_BASE_REF`, as in `HARNESS_BASE_REF=test/main`. Read the list of files the diff adds, committed or not: a file the change created that is not there is ignored by Git, and stays out of the review.

3. **Call the subagent.** Call `revisor-conformidade` with only the input lines the script printed: the path of the diff, the ticket identifier, the paths of the plan message and the contract drift and, when printed, the path of the visual reference, or, without a ticket, the path of `criterios.md` and the notice that there is no plan commit. Do not add your summary of the change, your opinion of it or what you think deserves attention: the value of the review is that it does not start from your conclusions. Run it in the branch checkout, because it reads the branch's acceptance file.

4. **Record.** As soon as the subagent returns, write `revisao.md` in the same folder, in the format below, with its report verbatim inside `<details>` and one table row per finding. Do not omit a finding nor edit the report. With no findings, write the file anyway, with the table empty and the report. Git ignores the file, as it ignores everything in the ticket folder but the acceptance file.

5. **Triage.** Decide each finding and fill its row:
   - **Agree:** fix it. The situation is `Corrigido`, and the reason says what changed.
   - **Disagree:** the situation is `Não corrigido`, and the reason says why it stays as it is.
   - **High severity you would leave unfixed:** stop and ask the user before going on. Write the decision and that it was the user's in the reason.

   In `/implement-spec`, one implementer subagent fixes the findings of `/code-review` and of every ticket's review, as that skill says. The commit after the fixes does not go through the reviewer again: the `full` verifies it.

6. **Go on** to the `full`, as the root `AGENTS.md` says in "Definição de pronto". In `/implement-spec`, that is after every ticket's review and the fixes, and not after each ticket.

## Publish

When the pull request exists, post each `revisao.md` of the branch as one comment, one per ticket. The file is local and ignored by Git, so publish from the checkout where the review ran; if it is missing (another checkout, a cleaned worktree), run the review again instead of writing the comment from memory.

```bash
gh pr comment <pr> --body-file docs/tickets/<pai>/<ticket>/revisao.md
```

Add `--repo <owner>/<repo>` when the pull request is not on the default remote. If the pull request already has the comment of that ticket, edit it instead of posting a second one: find its id by the title, then replace its body.

```bash
gh api repos/<owner>/<repo>/issues/<pr>/comments --paginate \
  --jq '.[] | select(.body | startswith("## Revisão de conformidade: <ticket>\n")) | .id'
gh api -X PATCH repos/<owner>/<repo>/issues/comments/<id> -F body=@docs/tickets/<pai>/<ticket>/revisao.md
```

The comment is the record the root `AGENTS.md` asks for, section "Revisão de conformidade".

## Format of `revisao.md`

The title names the ticket, or `sem ticket (<nome>)` for a change without one.

```markdown
## Revisão de conformidade: <ticket>

| # | Severidade | Achado | Situação | Motivo |
| --- | --- | --- | --- | --- |
| 1 | alta | O que o revisor apontou | Corrigido | O que mudou |
| 2 | média | O que o revisor apontou | Não corrigido | Por que ficou como está |

<details>
<summary>Relatório do revisor, na íntegra</summary>

(o relatório, sem edição)

</details>
```

## Without subagents

In an agent that cannot call a subagent, run the review in a new session, with the instructions of `.claude/agents/revisor-conformidade.md` and the same inputs, and record and publish it the same way.
