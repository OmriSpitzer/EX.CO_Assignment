# Tests

These checks prove the exercise in `docs/assignment.pdf`. `AGENTS.md` allows a box in `docs/STRUCTURE.md` to be marked done only after the check named on that step passes.

The automated suite on `main` is only the two folders below. Run them from the repository root with `npm test`.

| Suite | Path | What it proves |
| --- | --- | --- |
| Unit | `test/unit/App.test.tsx` | The TypeScript React page renders the message, version, and pod name. |
| Functionality | `test/functional/server.test.ts` | `GET /healthz` returns 200, and `GET /` returns HTML containing those three facts. |

Cluster, rollout, and browser checks later in this file are manual checks for later steps. They are not test files yet.

Commands below are for Windows PowerShell, which is the shell on this machine. On the assignment Mac, use `curl` instead of `curl.exe`, and `export KUBECONFIG=infra/kubeconfig` instead of `$env:KUBECONFIG`.

Run cluster commands only after step 1.1, with:

```powershell
$env:KUBECONFIG = "C:\GitProjects\EX.CO_Assignment\infra\kubeconfig"
```

Use `curl.exe`, not `curl`. In Windows PowerShell 5, `curl` is an alias of `Invoke-WebRequest` and will not accept these flags.

## Requirement map

| Assignment requirement | Check |
| --- | --- |
| Tools installed, including Terraform, kubectl, git, containers, local Kubernetes | Tools |
| Repository exists on the user's GitHub account | Repository |
| `GET /` is HTML and shows message, version, and pod name | Unit tests, Functionality tests, Image run, Browser |
| `GET /healthz` returns 200 | Functionality tests, Image run, Workload |
| Image runs as a non-root user | Image run |
| Terraform builds 1 control-plane + 2 workers and ingress (Argo deferred) | Cluster shape, Controllers |
| `terraform apply` creates it, `terraform destroy` removes it | Cluster shape, Destroy |
| Manifests in git; applied with kubectl for now (Argo deferred) | App deploy |
| Later: Argo CD syncs them, no `kubectl apply` from CI | Argo CD, GitOps rollout |
| At least 2 replicas, readiness, liveness, requests, limits | Workload |
| Ingress opens in the browser on this laptop | Browser |
| Push to `main` builds and pushes a SHA tag to GHCR | Registry |
| Workflow updates the tag in git, Argo CD rolls it out | GitOps rollout |
| A request loop sees no failed responses during rollout | Rollout loop |
| HPA min 2 max 5 | HPA |
| Prometheus and Grafana via Argo CD | Metrics |

## Tools

Step 0.1. All of these print a version, and Docker can run a container:

```powershell
docker version
kind version
kubectl version --client
terraform version
node -v
git --version
```

`node -v` is v22. `docker version` shows a running engine. If the engine is stopped, start Docker Desktop and run `docker version` again.

## Repository

Step 0.2. `git remote -v` shows the user's GitHub repository, and `gh repo view` (or the GitHub page) opens that repo. The default branch is `main`.

## Unit tests

Step 0.4. File `test/unit/App.test.tsx`. Vitest and React Testing Library, from the repo root: `npm run test:unit`.

Render `<App boot={{ message: "Hello from EX.CO", version: "1.2.3", podName: "pod-a" }} />` and assert the document shows:

- `Hello from EX.CO`
- `Version: 1.2.3`
- `Pod: pod-a`

## Functionality tests

Step 0.4. File `test/functional/server.test.ts`. Same Vitest run, Node environment: `npm run test:functional`. No client build is required. The test starts the app on an ephemeral port and uses `fetch`.

Set the environment inside the test, then request the app:

- `APP_MESSAGE=Hello from EX.CO`
- `APP_VERSION=test-version`
- `HOSTNAME=exco-web-abc123`

`GET /healthz`:

- status `200`
- `Content-Type` contains `text/plain`
- body is `ok`

`GET /`:

- status `200`
- `Content-Type` contains `text/html`
- body contains `Hello from EX.CO`
- body contains `test-version`
- body contains `exco-web-abc123`
- body contains `id="message"`, `id="version"`, and `id="pod"`

A JSON body fails this check even if the fields are present.

## Image run

Step 0.5. This is a container check, not a file under `test/`. Free port 8080 first.

```powershell
docker build -t exco-web:local .
docker rm -f exco-web-test 2>$null
docker run -d --name exco-web-test -p 8080:8080 -e APP_MESSAGE="Hello from EX.CO" -e APP_VERSION=0.1.0 exco-web:local
docker exec exco-web-test id -u
curl.exe -fsS http://localhost:8080/healthz
curl.exe -fsS http://localhost:8080/
docker rm -f exco-web-test
```

Pass:

- `id -u` prints `1000`
- `/healthz` prints `ok`
- `/` is HTML and contains `Hello from EX.CO`, `0.1.0`, and a host name
- the container was removed so later the ingress can bind 8080

## Cluster shape

Step 1.1.

```powershell
kubectl get nodes -o wide
```

Pass: 3 nodes, exactly one with the control-plane role, two workers, all `Ready`.

## Controllers

Step 1.1.

```powershell
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

Pass: ingress-nginx controller pod `Running` on the node labeled `ingress-ready=true`. Argo CD is deferred for this build, so no `argocd` pods are required.

## Destroy

Step 1.2.

```powershell
terraform -chdir=infra plan -destroy
```

Pass: the plan lists the kind cluster and the ingress Helm release for destroy (2 to destroy in the current Terraform).

If a real destroy was run, `kind get clusters` no longer lists `exco`, and a following `terraform apply` makes “Cluster shape” and “Controllers” pass again. If the clock is after 17:30, skip the real destroy and leave the cluster up. The plan output is the check.

## App deploy

Step 2.1 (current path without Argo CD).

```powershell
kind load docker-image exco-web:local --name exco
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/
kubectl get pods -n exco
kubectl get deploy,svc,ingress -n exco
```

Pass: Deployment `exco-web` exists, pods are `Running`/`Ready`, Service and Ingress exist. Apply `00-namespace.yaml` first so alphabetical `kubectl apply -f k8s/` does not race the namespace.

## Argo CD

Deferred. When Argo is installed later, replace “App deploy” with:

```powershell
kubectl get application exco-web -n argocd
kubectl get pods -n exco
```

Pass then: `Synced` and `Healthy`, and pods belong to Deployment `exco-web`.

## Workload

Step 2.2.

```powershell
kubectl get deploy exco-web -n exco -o yaml
kubectl get pods -n exco
```

Pass, all in that Deployment:

- `replicas` is at least 2, and that many pods are `Running` and `Ready`
- readiness probe path `/healthz` port `http`
- liveness probe path `/healthz` port `http`
- requests and limits are set on cpu and memory
- `runAsNonRoot` is true and `runAsUser` is 1000
- rolling update `maxUnavailable` is 0

```powershell
kubectl exec -n exco deploy/exco-web -- id -u
kubectl exec -n exco deploy/exco-web -- wget -qO- http://127.0.0.1:8080/healthz
```

Pass: uid `1000`, body `ok`. Alpine’s image includes `wget`. If `wget` is missing, use a one-off curl pod against the Service instead of installing tools into the app image.

## Browser

Step 2.3.

```powershell
curl.exe -fsS http://localhost:8080/healthz
curl.exe -fsS http://localhost:8080/
```

Then open http://localhost:8080 in the browser.

Pass:

- `/healthz` is `ok`
- the page shows the message, the version, and a pod name
- the pod name equals a live pod: `kubectl get pods -n exco -o name`
- a reload can show the other replica’s name

## Registry

Step 3.1. After a push to `main` that changes the app or the Dockerfile, the Actions run is green and the package `ghcr.io/<github-user>/<repo>` has a tag equal to that commit’s full SHA.

## GitOps rollout

Step 3.2.

- The workflow commit changes the `image:` line in `k8s/deployment.yaml` to the SHA tag.
- The workflow log contains no `kubectl apply`.
- `kubectl get application exco-web -n argocd` returns to `Synced` `Healthy`.
- `kubectl get deploy exco-web -n exco -o jsonpath="{.spec.template.spec.containers[0].image}"` prints that same SHA tag.

## Rollout loop

Step 3.3. `scripts/rollout-loop.ps1` prints one status code about five times a second:

```powershell
while ($true) {
  $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/
  Write-Output ("{0} {1}" -f (Get-Date -Format "HH:mm:ss"), $code)
  Start-Sleep -Milliseconds 200
}
```

Start the loop, change `APP_MESSAGE`, push, and wait until Argo CD is `Healthy` on the new commit.

Pass: every printed code is `200`, and a later request’s HTML contains the new message. Any `000`, `404`, or `5xx` fails the check.

## HPA

Step B1, only if that step was attempted.

```powershell
kubectl get hpa -n exco
```

Pass: min replicas 2, max replicas 5, target is CPU utilization. `metrics-server` is installed if the targets column shows a percentage. `<unknown>` means the HPA object exists and the metrics pipeline does not; say so in the README and leave B1 open.

## Metrics

Step B2, only if that step was attempted.

```powershell
kubectl get application -n argocd
kubectl get pods -n monitoring
```

Pass: an Argo CD application for the monitoring stack is `Synced` and `Healthy`, and Grafana and Prometheus pods are `Running`. Open Grafana with a port-forward and confirm the login page loads.

## What “done” means for the whole exercise

Parts 0–2 are the bar for 18:00: Tools, Repository, Unit tests, Functionality tests, Image run, Cluster shape, Controllers, Destroy (plan is enough after 17:30), App deploy (Argo deferred), Workload, and Browser.

Registry, GitOps rollout, and Rollout loop close Part 3. HPA and Metrics close the bonus installs. They stay unrun until those steps are actually done.
