# Build plan

Deadline: **18:00 local (UTC+2), 2026-11-09**. Planning started 16:19. This file is the checklist. `AGENTS.md` is the rule for closing a box: the matching check in `docs/TESTS.md` must pass first.

Last checkbox update: **2026-11-09 17:39**. Next open step: **C1 README close-out** (Part 3 only if time; Argo CD deferred).

## Status

| Part | What | State |
| --- | --- | --- |
| Docs | Agent guide, this plan, tests, prompt log, README | Done 16:25 |
| 0 | Tools, repo, web service, Docker image | Done 16:42 |
| 1 | Terraform: kind + ingress-nginx (Argo CD deferred) | Done 17:35 |
| 2 | Manifests + browser via kubectl (Argo deferred) | Done 17:39 |
| 3 | GitHub Actions, GHCR, git tag update, zero downtime | Open; skip if clock ≥ 17:45 |
| Bonus | HPA, Prometheus + Grafana | Open, after Part 3 |
| Bonus | EKS notes in the README | Done 16:25 (written, cluster stays local) |
| My add ons | Load balancer in front of the replicas | Open. Not part of the assignment |
| Close | End-of-build README, push, cluster left running | Open |

## Clock

| Time | Work |
| --- | --- |
| 16:25–16:40 | 0.1 tools, 0.2 GitHub repository |
| 16:40–17:05 | 0.4 service and its tests |
| 17:05–17:20 | 0.5 image build and local run |
| 17:20–17:45 | Part 1 and Part 2, page open at http://localhost:8080 |
| 17:45–18:00 | README close-out, prompts, push, leave the cluster up |
| Only if Part 2 is green before 17:40 | Part 3 |
| Only if Part 3 is green and the clock is before 17:50 | HPA, then Prometheus and Grafana |

If the clock hits 17:45 and Part 2 is still open, skip Part 3 and the bonus installs. Finish the browser path.

## Decisions already made

- **TypeScript React + Node in one image.** The UI is React written in TypeScript. Express serves it and writes the message, version, and pod name into the HTML, so a browser and a plain HTTP client both see them. The pod name is `HOSTNAME`, which Kubernetes sets to the pod name. When `HOSTNAME` is unset, the page uses the host name.
- **Tests on `main` under `test/`.** `test/unit` covers the React component. `test/functional` covers `GET /` and `GET /healthz`. Those are the only automated tests until a later step adds more.
- **kind through Terraform** (`tehcyx/kind`). One `kind_cluster` describes 1 control-plane and 2 workers. `terraform destroy` deletes that cluster.
- **ingress-nginx** installed by Terraform (Helm). **Argo CD is deferred** for this build: Helm installs kept hanging and the deadline is 18:00. App manifests under `k8s/` are applied with `kubectl apply -f k8s/` for now. Revisit Argo CD only if time remains after the browser path is green.
- **Host port 8080.** The laptop opens http://localhost:8080. Binding host port 80 needs an administrator and often fails on Windows.
- **Kubeconfig path `infra/kubeconfig`.** The personal `~/.kube/config` stays untouched. Git ignores this file.
- **Local image `exco-web:local`** until Part 3. Then `ghcr.io/<github-user>/<repo>:<commit-sha>`.
- **Namespace `exco`, Deployment/Service name `exco-web`.**
- **Public GitHub repository** if the user can make it public, so Argo CD can read it with no credential. A private repo needs an Argo CD repository secret, which costs time.

## My add-ons

Features that are not in the assignment. They stay behind Parts 0–2.

- [ ] **A1. Load balancer for the replicas**
  - Put a load balancer in front of the `exco-web` pods so requests spread across the replicas.
  - kind has no cloud load balancer of its own. Use kind’s cloud provider (`cloud-provider-kind`) so a Service of type `LoadBalancer` receives an address, or install MetalLB if that provider is not running.
  - The assignment Ingress on http://localhost:8080 stays as it is. This load balancer is a second front door for the same pods.
  - Check: the Service shows an external address, and repeated requests can land on more than one pod name.

## Target tree

```
README.md
docs/assignment.pdf
AGENTS.md
docs/STRUCTURE.md
docs/TESTS.md
docs/ai-prompts.md
client/                 Vite + React, TypeScript
server/                 Express
test/unit               React unit tests
test/functional         HTTP functionality tests
Dockerfile
.dockerignore
infra/                  Terraform
k8s/                    manifests Argo CD syncs
scripts/verify-cluster.ps1
scripts/rollout-loop.ps1
.github/workflows/release.yml
```

## Contract the service must keep

Environment:

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | Listen port | `8080` |
| `APP_MESSAGE` | Sentence on the page | `Hello from EX.CO` |
| `APP_VERSION` | Version on the page | `0.1.0` |
| `HOSTNAME` | Pod name on the page | the process host name |

Routes:

- `GET /healthz` → `200`, body `ok`, `Content-Type: text/plain`.
- `GET /` → `200`, `Content-Type: text/html`. The raw body contains the message, the version, and the pod name as text (element ids `message`, `version`, `pod`).
- Other paths serve the Vite build from `client/dist` when that folder exists.

Server behavior for `GET /`:

- Read `client/dist/index.html` when it exists.
- Inject `window.__BOOT__ = {"message","version","podName"}` before `</head>`. Escape `<` in that JSON as `\u003c`.
- Put the three facts inside `<div id="root">` as real text, so the first paint and `curl.exe` both show them. React then renders the same three facts from `window.__BOOT__`.
- When `client/dist/index.html` is missing (functionality tests), return a small HTML document with the same three ids.

React (`client/src/App.tsx`):

- Render `message`, `Version: <version>`, and `Pod: <podName>` from the `boot` prop, or from `window.__BOOT__` when the prop is absent.
- Export `App` so `test/unit/App.test.tsx` can pass `boot` without a browser.

Image:

- Multi-stage `node:22-alpine`.
- Build the client, install server production dependencies, copy both into the runtime stage.
- `COPY --chown=node:node`. `USER node` (uid 1000). `EXPOSE 8080`. `CMD ["node", "index.js"]`.

Deployment (written this way from the start, so Part 3 does not need a redesign):

- `replicas: 2`
- `maxUnavailable: 0`, `maxSurge: 1`
- container port `8080`, named `http`
- readiness and liveness `httpGet` on `/healthz`
- requests `cpu: 50m`, `memory: 64Mi`; limits `cpu: 200m`, `memory: 128Mi`
- `runAsNonRoot: true`, `runAsUser: 1000`
- `imagePullPolicy: IfNotPresent` while the tag is `:local`
- `preStop`: `sh -c "sleep 5"` so a rollout can drain before the process exits
- env `APP_MESSAGE`, `APP_VERSION`. Do not set `HOSTNAME`.

Ingress: class `nginx`, no host rule, path `/` prefix, service `exco-web` port `80`. The Service maps port `80` to target port `8080`.

## Steps

### Documents

- [x] **D1. Write the working set** (done 16:25)
  - `docs/AGENTS.md`, `docs/STRUCTURE.md`, `docs/TESTS.md`, `docs/ai-prompts.md`, and `README.md`.
  - Check: the five files exist and this box is the record.

### Part 0 — Set up and plan

- [x] **0.1 Install tools**
  - Docker Desktop (running), `kind`, `kubectl`, Terraform, Node.js 22, git.
  - Check: TESTS.md “Tools”.

- [x] **0.2 GitHub repository**
  - The user logs in with their own GitHub account and creates the repository.
  - Default branch `main`. Public if they are willing.
  - Record the owner and name in `README.md` where `<github-user>` and `<repo>` appear.
  - Check: TESTS.md “Repository”. The agent cannot complete GitHub login for the user.

- [x] **0.3 Start the README** (done 16:25)
  - Plan, tools, and build/run steps are in `README.md`.
  - Keep updating it when later steps change a command.

- [x] **0.4 Web service** (done 16:42)
  - `server/` Express app with the contract above. `client/` is a Vite + React + TypeScript app with the `App` contract above.
  - Tests live in `test/` on `main`: `test/unit/App.test.tsx` and `test/functional/server.test.ts`. No other automated tests yet.
  - `.gitignore` ignores `node_modules/`, `client/dist/`, `infra/.terraform/`, `infra/kubeconfig`, `*.tfstate`, `*.tfstate.*`. Commit `.terraform.lock.hcl` once it exists.
  - Check: TESTS.md “Unit tests” and “Functionality tests”.

- [x] **0.5 Dockerfile, local run** (done 16:42)
  - `Dockerfile` and `.dockerignore` (`node_modules`, `client/dist`, `.git`, `infra`, `docs`, `test`).
  - Build `exco-web:local`, run it, open http://localhost:8080, then stop it so port 8080 is free for the ingress.
  - Check: TESTS.md “Image run”.

### Part 1 — Cluster as code

Files under `infra/`:

- `versions.tf` — providers `tehcyx/kind`, `hashicorp/kubernetes`, `hashicorp/helm`.
- `kind.tf` — `kind_cluster.exco`:
  - `name = "exco"`
  - `wait_for_ready = true`
  - `kubeconfig_path` = `infra/kubeconfig` (use `path.module`, do not point this at `~/.kube/config`)
  - `kind_config`: one node `role = "control-plane"`, two nodes `role = "worker"`
  - control-plane `extra_port_mappings`: container `80` → host `8080`, and container `443` → host `8443`
  - control-plane label `ingress-ready=true` via the kind node `labels` field. kind 0.33 uses kubeadm v1beta4, where a merge patch would replace the whole `kubeletExtraArgs` list.
- Helm release `ingress-nginx` in namespace `ingress-nginx`. Values that make kind publish the controller on the mapped port: `controller.hostPort.enabled = true` (do not use `hostNetwork`; it made the controller fail readiness on this laptop), `controller.service.type = NodePort`, node selector `ingress-ready=true`, toleration for the control-plane.
- Wire the Helm and Kubernetes providers to `kind_cluster.exco` (`endpoint`, `client_certificate`, `client_key`, `cluster_ca_certificate`).
- Output the kubeconfig path.
- **Argo CD Helm release is out of Terraform for now** (see Decisions). Keep `gitops/exco-web-application.yaml` in the repo for a later install.

- [x] **1.1 Terraform creates the cluster and ingress** (done 17:35)
  - Argo CD not required for this checkbox in this build.
  - Check: TESTS.md “Cluster shape” and “Controllers”.
- [x] **1.2 Destroy removes it** (done 17:35)
  - `terraform plan -destroy` lists the kind cluster and the ingress Helm release (2 to destroy). No real destroy after 17:30.
  - Check: TESTS.md “Destroy”.

### Part 2 — App deployment (kubectl for now; Argo later)

`k8s/namespace.yaml`, `k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/ingress.yaml` follow the contract above. Image: `exco-web:local` until Part 3.

**Current path (deadline):**

```powershell
$env:KUBECONFIG = "C:\GitProjects\EX.CO_Assignment\infra\kubeconfig"
kind load docker-image exco-web:local --name exco
kubectl apply -f k8s/
```

**Deferred Argo CD path:** `gitops/exco-web-application.yaml` stays in the repo. When Argo is installed later, stop using `kubectl apply` for app changes and let the Application sync `k8s/`.

- [x] **2.1 Manifests applied (Argo deferred)** (done 17:39)
  - `kind load docker-image exco-web:local --name exco` after every local image build.
  - Apply `k8s/00-namespace.yaml` first, then `kubectl apply -f k8s/`.
  - Check: TESTS.md “App deploy” (replaces “Argo CD” until Argo is installed).

- [x] **2.2 Two replicas, probes, requests, and limits** (done 17:39)
  - Check: TESTS.md “Workload”.

- [x] **2.3 The ingress opens on this laptop** (done 17:39)
  - http://localhost:8080 shows the message, version, and a pod name.
  - Refresh twice and confirm the pod name can change (two replicas).
  - Check: TESTS.md “Browser”.

### Part 3 — CI/CD (only after Part 2 is green)

`.github/workflows/release.yml`:

- Trigger: push to `main`, paths `client/**`, `server/**`, `Dockerfile` only. A commit that touches just `k8s/` must not start another build, or the tag update loops forever.
- Permissions: `contents: write`, `packages: write`.
- Build and push `ghcr.io/<github-user>/<repo>:<full-commit-sha>` with `GITHUB_TOKEN`.
- Replace the image line in `k8s/deployment.yaml` with that tag and push a commit to `main`.
- The workflow does not call `kubectl`.
- After the first push, if the pod is `ImagePullBackOff`, make the GHCR package public or add an image pull secret. Unique SHA tags stay `IfNotPresent`.

- [ ] **3.1 Workflow builds and pushes the SHA tag**
  - Check: TESTS.md “Registry”.
- [ ] **3.2 Git tag update, Argo CD rolls out**
  - Check: TESTS.md “GitOps rollout”.
- [ ] **3.3 Zero downtime**
  - Change `APP_MESSAGE`, push, run `scripts/rollout-loop.ps1` for the whole rollout.
  - Check: TESTS.md “Rollout loop”.

### Bonus (only with time left)

- [ ] **B1. HorizontalPodAutoscaler** in `k8s/`, min 2, max 5, CPU utilization target. Argo CD syncs it. Needs `metrics-server` on kind or the HPA stays `<unknown>`.
  - Check: TESTS.md “HPA”.

- [ ] **B2. Prometheus and Grafana through Argo CD** (kube-prometheus-stack as its own Application, or a second path in the repo). Grafana reachable by port-forward.
  - Check: TESTS.md “Metrics”.

- [x] **B3. EKS notes** (done 16:25)
  - Written in `README.md`. This does not create a cloud cluster.

### Close-out before 18:00

- [ ] **C1. Finish the README close-out** from real results: what finished, what is missing, one decision and why, one place the AI was wrong and how you noticed. Do not invent the AI mistake.
- [ ] **C2. Push** `main`**, including** `docs/ai-prompts.md`**.** Leave the cluster running. Do not run `terraform destroy` in this step.
- [ ] **C3. Every box above matches reality.** Open boxes are unfinished. Closed boxes have a passing check.

## After the review

`terraform destroy` from `infra/` with `KUBECONFIG` still pointed at `infra/kubeconfig`, then unset `KUBECONFIG`.
