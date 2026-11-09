# Agent guide

Build the exercise in `docs/assignment.pdf`. The deadline is **18:00 local time (UTC+2) on 2026-11-09**. Ship a running cluster before any extra scope.

## Which document wins

Read in this order. The earlier document wins when two of them disagree.

1. `docs/assignment.pdf` — the requirements.
2. `docs/STRUCTURE.md` — the plan and the checkboxes. Do the steps in order.
3. `docs/TESTS.md` — the checks that prove a step.
4. `README.md` — what a reviewer reads. Update it when a command or behavior changes.
5. `docs/ai-prompts.md` — one row per conversation: the full prompt, a brief answer, the time, and the files changed as a list.

## How a step is marked finished

When you finish a step in `docs/STRUCTURE.md`:

1. Run the check named on that step in `docs/TESTS.md`.
2. If the check passes, change that step from `- [ ]` to `- [x]` and add the time: `(done HH:MM)`.
3. If the check fails, leave the box open and fix the work.
4. Update the status table at the top of `docs/STRUCTURE.md`.
5. Update `README.md` if the runbook changed.
6. Add a row to `docs/ai-prompts.md`: the full user prompt, a brief answer, the local time, and the files changed as a list.

Do not mark a step whose earlier step is still open. Do not mark a step because the files exist. Mark it because the check passed.

## Stack

Keep this stack. The details live in `docs/STRUCTURE.md`.

- React + TypeScript (Vite) for the page
- Node.js (Express) for `GET /` and `GET /healthz`
- Automated tests live in `test/` on `main`: `test/unit` and `test/functional` only, until a later step adds more
- One Docker image, process uid 1000
- Terraform, kind (1 control-plane + 2 workers), ingress-nginx
- Argo CD deferred for this build; apply `k8s/` with kubectl until Argo is installed
- GitHub Actions and GHCR only after the page opens in the browser

## Working rules

- `GET /` returns HTML. The body text includes the message, the app version, and the pod name. `GET /healthz` returns 200.
- The image and the pod run as uid 1000.
- For now: `kubectl apply -f k8s/` after `kind load docker-image`. Argo CD sync of `k8s/` is deferred.
- Keep `infra/kubeconfig` out of git. Point `KUBECONFIG` at that file.
- At **17:45** stop new scope. Finish the README close-out, push, and leave the cluster running.
- The assignment review reads the git history. Commit when the user asks, and remind them at the end of each finished step if the work is still uncommitted.
- Read every change. Be ready to explain any file in the review.
