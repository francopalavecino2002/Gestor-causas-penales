---
description: Execute the next ready ROADMAP task end to end (branch, delegate, verify, review, PR, merge)
---

Run exactly one iteration of "The work loop" defined in `CLAUDE.md`. Do not ask questions.

1. `git checkout main && git pull --ff-only`. Make sure the working tree is clean; if it is
   not, stash with a message and note it in the PR.
2. Read `ROADMAP.md`. Pick the first `todo` task whose needs are satisfied (task ids `done`;
   gates open as defined in the ROADMAP legend). If a task is `in-progress` on a branch that
   still exists, resume it instead. If nothing is ready, print `NO_READY_TASKS` and stop.
3. Create the branch, mark the task `in-progress`, draft `.agent-tmp/pr-body.md` from
   `.github/pull_request_template.md`.
4. Delegate by owner (`backend-engineer`, `frontend-engineer` subagents, or do it yourself).
5. Verify yourself with the commands in `CLAUDE.md`. Up to 3 fix rounds.
   If still red: set the task `blocked` with a one-line reason, commit that ROADMAP change on
   the branch, push, open the PR as **draft** titled `wip: <task>` explaining the blocker,
   print `TASK_BLOCKED`, and stop.
6. Run the `pr-reviewer` subagent; fix every must-fix and should-fix.
7. Commit in logical Conventional Commits. Mark the task `done` in ROADMAP.md in the last
   commit. Add the entry to `CHANGELOG.md` (create it if missing).
8. `git push -u origin <branch>` and `gh pr create --title "<conventional title>" --body-file .agent-tmp/pr-body.md`
   with labels matching the area (`backend`, `frontend`, `docs`, `ci`) when they exist.
9. Wait for CI. GitHub can take a few minutes to register checks on a new PR, and
   `gh pr checks` fails with "no checks reported" meanwhile: that is not a blocker. Retry
   `gh pr checks <n>` every 60 seconds for up to 15 minutes until checks appear, then run
   `gh pr checks <n> --watch`. Never mark a task blocked only because CI has not started yet;
   if it never starts, leave the PR open, print `TASK_DONE <id> <PR url> (merge pending CI)`
   and stop. If CI fails, fix and push (max 3 rounds). If green and
   `AUTO_MERGE=true` in CLAUDE.md: `gh pr merge --squash --delete-branch`, then
   `git checkout main && git pull --ff-only`.
10. Print one final line: `TASK_DONE <id> <PR url>`.
