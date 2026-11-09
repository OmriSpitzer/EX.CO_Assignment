# EX.CO local GitOps exercise

Small web service, built into one container, deployed to a local Kubernetes cluster the GitOps way.

**Status, 2026-11-09 16:42 (UTC+2).** The TypeScript React page, the Node server, their unit and functionality tests, and the Docker image are in the repo. Terraform and the Kubernetes manifests are not. Follow `docs/STRUCTURE.md` from step 0.1. Deadline for a running cluster: **18:00 local**.

| Guide | Role |
| --- | --- |
| `docs/assignment.pdf` | The requirements |
| `AGENTS.md` | How an agent works the exercise, and when a step counts as done |
| `docs/STRUCTURE.md` | The plan, in order, with checkboxes |
| `docs/TESTS.md` | The checks that prove each requirement |
| `docs/ai-prompts.md` | Exact log of AI conversations |

## What the service does

One process listens on port **8080**.

| Request | Response |
| --- | --- |
| `GET /` | HTML page. Visible text: a message, the app version, and the name of the pod serving the request. |
| `GET /healthz` | `200` and the body `ok`. |

The page is a React app written in TypeScript. Express (Node.js) serves it and writes the three facts into the HTML itself, so they are on screen in the browser and present in the response body before JavaScript runs. Kubernetes sets `HOSTNAME` to the pod name, and the page prints that value. On a laptop, with `HOSTNAME` unset, the page prints the machine host name.

| Variable | Default | Role |
| --- | --- | --- |
| `APP_MESSAGE` | `Hello from EX.CO` | The sentence on the page |
| `APP_VERSION` | `0.1.0` | The version on the page. CI replaces the running value with the git commit SHA. |
| `PORT` | `8080` | Listen port |
| `HOSTNAME` | set by the system | Shown as the pod name. The manifest does not override it. |

## Architecture

```
Browser  →  http://localhost:8080
         →  ingress-nginx on the kind control-plane (host 8080 → container 80)
         →  Service exco-web:80
         →  Deployment exco-web, 2 pods, namespace exco
              each pod: Node.js (Express) + the React build, uid 1000
```

Terraform creates the cluster and installs ingress-nginx and Argo CD. Argo CD watches this repo’s `k8s/` directory and syncs the Deployment, Service, and Ingress. A later GitHub Actions workflow builds the image, pushes it to GHCR tagged with the commit SHA, and commits that tag into `k8s/`. Argo CD rolls the new tag out. CI does not run `kubectl apply`.

```
GitHub main
  ├─ client/, server/, Dockerfile  →  Actions  →  ghcr.io/<github-user>/<repo>:<sha>
  └─ k8s/                          →  Argo CD  →  local kind cluster "exco"
```

Until that workflow exists, the cluster runs a locally built image, `exco-web:local`, loaded into kind with `kind load docker-image`.

## Tools

Chosen for a three-node local cluster that Terraform can create and destroy:

| Tool | Why |
| --- | --- |
| Node.js 22 | Server runtime and the React build |
| React (Vite) | The page |
| Express | `GET /` and `GET /healthz` |
| Docker | The image. The process runs as the image’s `node` user, uid 1000. |
| kind | Local Kubernetes. One control-plane and two workers. |
| Terraform provider `tehcyx/kind`, plus Helm and Kubernetes providers | Cluster, ingress-nginx, and Argo CD as code |
| ingress-nginx | The page on this laptop at http://localhost:8080 |
| Argo CD | Syncs `k8s/` from git |
| GitHub Actions + GHCR | Part 3, after the page is already up |
| kubectl, git | Inspect the cluster, keep history |

This repo is on Windows. The assignment text assumes a Mac. The same tools and the same ports apply. The command differences are `curl.exe` and `$env:KUBECONFIG` on Windows, `curl` and `export KUBECONFIG` on macOS.

## Repository layout (once the plan is built)

```
client/          Vite + React + TypeScript UI
server/          Express server
test/unit        React unit tests
test/functional  HTTP functionality tests
Dockerfile
infra/           Terraform (kind, ingress-nginx, Argo CD)
k8s/             Deployment, Service, Ingress (synced by Argo CD)
gitops/          Argo CD Application bootstrap
scripts/         Docker smoke, cluster verify, rollout loop
.github/workflows/release.yml
docs/            Assignment, plan, tests, prompt log
```

## Prerequisites

Install and confirm:

```powershell
docker version
kind version
kubectl version --client
terraform version
node -v
git --version
```

`node -v` should report v22, and `docker version` should show a running engine. Start Docker Desktop if the engine is down.

Log in to GitHub with your own account and create the repository. Replace `<github-user>` and `<repo>` below with that repository. A public repo lets Argo CD clone it with no credential. On a private repo, add an Argo CD repository secret before expecting a sync.

## Build

From the repository root, once `client/` and `server/` exist:

```powershell
npm ci --prefix client
npm run build --prefix client
npm ci --prefix server
```

The container build does those steps itself:

```powershell
docker build -t exco-web:local .
```

## Run on the laptop, without Kubernetes

Use this to see the page before the cluster exists. From the repo root, after the client build:

```powershell
$env:APP_MESSAGE = "Hello from EX.CO"
$env:APP_VERSION = "0.1.0"
$env:PORT = "8080"
node server/index.js
```

Open http://localhost:8080. You should see the message, version `0.1.0`, and this machine’s host name as the pod line. http://localhost:8080/healthz returns `ok`.

Stop the process before the cluster ingress needs port 8080.

## Run the image

```powershell
docker build -t exco-web:local .
docker rm -f exco-web-test 2>$null
docker run -d --name exco-web-test -p 8080:8080 -e APP_MESSAGE="Hello from EX.CO" -e APP_VERSION=0.1.0 exco-web:local
docker exec exco-web-test id -u
curl.exe -fsS http://localhost:8080/healthz
curl.exe -fsS http://localhost:8080/
```

`id -u` prints `1000`. The HTML contains the message, `0.1.0`, and a host name. Then free the port:

```powershell
docker rm -f exco-web-test
```

The same checks are written in `docs/TESTS.md` under “Image run”. Unit and functionality tests are `npm test` from the repo root.

## Run the cluster

Kubeconfig is written to `infra/kubeconfig` so your default kubeconfig is left alone. Set it in the shell you use for kubectl:

```powershell
$env:KUBECONFIG = "C:\GitProjects\EX.CO_Assignment\infra\kubeconfig"
terraform -chdir=infra init
terraform -chdir=infra apply
```

`apply` creates:

- kind cluster `exco`: 1 control-plane, 2 workers
- host port **8080** forwarded to the control-plane’s port 80, and host port **8443** to 443
- ingress-nginx
- Argo CD

Load the local image into the cluster (kind cannot see host-local images otherwise), then bootstrap Argo CD from the Application manifest. The Application’s `repoURL` must be your GitHub repo, and `k8s/` must already be on `main`.

```powershell
kind load docker-image exco-web:local --name exco
kubectl apply -f gitops/exco-web-application.yaml
kubectl get nodes
kubectl get application exco-web -n argocd
```

Terraform may apply that Application for you (see `docs/STRUCTURE.md`). Either way, apply it once. After that, changes under `k8s/` come from Argo CD.

Open http://localhost:8080. The page shows the message, the version, and a pod name. Reload; the name can switch between the two replicas.

Argo CD UI (optional):

```powershell
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
kubectl -n argocd port-forward svc/argocd-server 8081:443
```

Decode the password, open https://localhost:8081, user `admin`. Leave 8080 for the app.

### Remove the cluster

The review needs the cluster left running. Do not destroy it at the end of build time.

When the review is over:

```powershell
terraform -chdir=infra destroy
```

That deletes the kind cluster, ingress-nginx, and Argo CD. Then you can unset `KUBECONFIG`.

To prove destroy without taking the cluster down, use:

```powershell
terraform -chdir=infra plan -destroy
```

The plan should list the cluster and both Helm releases.

## Tests

| Check | Command |
| --- | --- |
| Unit and functionality tests | `npm test` from the repo root |
| React component only | `npm run test:unit` |
| HTTP routes only | `npm run test:functional` |
| Image user and HTTP | the “Run the image” commands above |

What each assertion is, and what passes, is in `docs/TESTS.md`.

## CI/CD (Part 3, after the page is up)

On a push to `main` that changes `client/`, `server/`, or the `Dockerfile`:

1. GitHub Actions builds the image and pushes `ghcr.io/<github-user>/<repo>:<commit-sha>`.
2. The workflow writes that tag into `k8s/deployment.yaml` and pushes the commit.
3. Argo CD syncs and rolls out. The workflow does not call kubectl.

The workflow ignores pushes that only touch `k8s/`, so the tag commit does not build again.

A private GHCR package makes the new pods sit in `ImagePullBackOff`. Make the package public, or create an image pull secret, then let Argo CD sync again.

Zero-downtime check: start `scripts/rollout-loop.ps1`, change `APP_MESSAGE`, push, and watch the loop. Every code should be `200`, and the page should then show the new message. The Deployment uses `maxUnavailable: 0` and a short `preStop` sleep so the old pod stays ready until the new one is ready.

## Decisions

**TypeScript React and Node in a single image.** The UI is React in TypeScript, and the Node process is what can read `HOSTNAME` and answer `/healthz`. Putting both in one image keeps the manifest to one container, which is the right size for this exercise.

**kind, with host port 8080.** Terraform’s kind resource can describe exactly one control-plane and two workers, and `terraform destroy` removes them. Port 8080 avoids needing an administrator to bind port 80, which is a common failure on Windows.

**Argo CD owns the app, Terraform owns the platform.** Terraform installs the cluster, the ingress controller, and Argo CD, and it bootstraps the Application. It does not manage the Deployment. That split is what makes the CI rule (commit a new tag, do not `kubectl apply`) true.

**A separate kubeconfig file.** `infra/kubeconfig` is gitignored. The rest of the machine’s clusters stay out of this exercise.

## What is finished

- The requirement is captured in a plan: `docs/STRUCTURE.md`.
- The checks that prove it: `docs/TESTS.md`. Unit and functionality tests are the only automated tests so far.
- This runbook.
- The TypeScript React page, the Express server, and `npm test`.
- The Dockerfile. `exco-web:local` runs as uid 1000 and serves the page on port 8080.
- Notes below for running the same shape on EKS. No cloud resources were created.

## What is missing

- Terraform for kind, ingress-nginx, and Argo CD
- `k8s/` manifests and an Argo CD sync
- The page served by the cluster ingress on http://localhost:8080
- GitHub Actions, GHCR, and the zero-downtime rollout
- HPA, Prometheus, and Grafana

## One decision and why

See **Decisions** above. The one to defend in the review: the browser talks to one Node process that serves a React build and also prints the pod name into the HTML. A separate static site would still need a backend to learn the pod name, and two containers would spend time the deadline does not have.

## One place the AI was wrong, and how you noticed

Not recorded yet. Fill this from a real mistake before the review. Do not invent one.

## What would change on EKS

The app manifests stay close to what they are. The platform around them changes.

- Replace the kind Terraform with an EKS module: a VPC across at least two availability zones, a managed node group with at least two nodes (so two replicas can schedule), and remote state in S3 with a lock.
- Stop using host ports. Install the AWS Load Balancer Controller and an Ingress or Gateway that creates a real load balancer, with a DNS name and TLS from ACM. Keep the app listening on 8080.
- Push the image to ECR. Grant the node role (or IRSA, if you move the pull to a controller) permission to pull. Drop `kind load` and the `:local` tag.
- Keep Argo CD on the cluster, pointed at the same `k8s/` path. Store the repository credential in a secret sourced from AWS Secrets Manager, and turn off automated sync to production if a human should approve it. CI still only commits the image tag.
- Keep requests, limits, the non-root user, `maxUnavailable: 0`, and the HPA (min 2, max 5). Add a PodDisruptionBudget so a node upgrade cannot take both replicas at once.
- Run Prometheus with Amazon Managed Prometheus, or keep Grafana via Argo CD against that remote store. Skip a full in-cluster Prometheus if the cluster is small.
- `terraform destroy` from a laptop is not how production is torn down. Protect the state and require a reviewed plan.

## After you stop

Push `main`, including `docs/ai-prompts.md`. Leave the cluster running for the review. The checkbox state in `docs/STRUCTURE.md` should match what actually works.
