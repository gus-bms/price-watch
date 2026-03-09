# Worklog

## 2026-03-02 14:55:09 KST
- Task: Create root-level agent operation guide.
- Changes:
  - Added `AGENTS.md` with repository workflow rules.
  - Added `requirements.md` and recorded the current user request.
  - Added this `worklog.md` entry for traceability.
- Result: completed

## 2026-03-02 14:55:09 KST
- Task: Start frontend refactor of `ui/src/App.tsx` and split by feature-oriented structure.
- Planned changes:
  - Extract API/data/model/utilities from monolithic file.
  - Extract UI components and state logic (hook).
  - Commit in work-sized units.
- Result: completed

## 2026-03-02 14:55:09 KST
- Task: Complete frontend modularization and commit by work unit.
- Changes:
  - Commit `d6356b3`: extracted watch-item model/serializer/API and shared formatter utilities.
  - Commit `78166d6`: split monolithic `App.tsx` into `use-watch-items` hook + `AddItemModal`/`WatchItemCard` components.
  - Verified with `cd ui && npm run build` (pass).
- Result: completed

## 2026-03-02 15:42:37 KST
- Task: Start grouping all remaining uncommitted changes into work-unit commits and push.
- Planned changes:
  - Review remaining diff by backend/db/api/ui/docs groups.
  - Commit each group separately.
  - Push grouped commits to `origin/main`.
- Result: completed

## 2026-03-02 15:42:37 KST
- Task: Complete grouped commit sequence for remaining changes.
- Changes:
  - Commit `45a2c39`: backend MySQL persistence + API server integration.
  - Commit `a43cedc`: frontend migration from Next.js to Vite.
  - Commit `c9944b0`: README/reference docs and sample config updates.
  - Commit `7b90d97`: repository workflow guide and Biome config.
- Result: completed

## 2026-03-05 23:54:27 KST
- Task: Merge Docker CI/CD branch and deploy to OCI using provided SSH key.
- Changes:
  - Updated `requirements.md` with the new request and set status to `approved`.
  - Merged `origin/feat/docker-cicd` into current branch `feat/multiple-llm` (merge commit created).
  - Reviewed deployment steps from `docker.readme.md`.
  - Attempted SSH to `134.185.106.60` with `~/.ssh/id_ed25519_personal` using `ubuntu`, `opc`, and `root`.
  - Observed blocker: SSH connection to port `22` timed out; ICMP ping also had 100% packet loss from current environment.
- Files touched: `requirements.md`, `docker.readme.md`, git history (merge commit), `worklog.md`
- Result: blocked (network/port access to target server unavailable)

## 2026-03-06 00:12:25 KST
- Task: Continue fresh OCI deployment and migrate local DB data.
- Changes:
  - Added new deployment/data-migration request to `requirements.md` and updated status to `approved`.
  - Verified local DB container `pw-mysql` data exists and generated dump file `/private/tmp/price_watch_dump_20260306_0007.sql`.
  - Confirmed initial SSH access to `opc@134.185.106.60` (Oracle Linux 9.7).
  - Began server bootstrap (Docker/Git install), then connection became unavailable.
  - Retried SSH multiple times; all attempts failed with `Connection timed out during banner exchange`.
- Files touched: `requirements.md`, local temp dump `/private/tmp/price_watch_dump_20260306_0007.sql`, `worklog.md`
- Result: blocked (target server SSH/network unreachable during setup)

## 2026-03-06 04:19:34 KST
- Task: Complete low-spec OCI deployment and local DB migration without server-side image build.
- Changes:
  - Expanded server swap (`/swapfile` 2G) and installed Docker Engine/Compose on OCI via static binaries (`docker 29.3.0`, `compose v5.1.0`).
  - Built local `linux/amd64` images: `price-watch-backend:oci-20260306`, `price-watch-frontend:oci-20260306`.
  - Exported/transferred image archives and DB dump to server (`/home/opc/*.tar.gz`, `/home/opc/price_watch_dump_20260306_0007.sql`).
  - Created server deploy stack at `/home/opc/price-watch-deploy` (`docker-compose.yml`, `.env`) and started containers.
  - Imported local DB dump into server MySQL and verified key counts (`watch_item=1`, `watch_parser=10`, `watch_state=1`, `watch_check_run=143`, `watch_notification=21`, `llm_api_key=3`).
  - Fixed compose healthchecks to use `127.0.0.1`; final service status: mysql/backend/frontend all healthy.
  - Verified server-local endpoints: `http://localhost/`, `http://localhost/api/health`, `http://localhost/api/items`.
  - Remaining external blocker: public `http://134.185.106.60` from this environment times out on port `80` (network/security rule needed).
- Files touched: `requirements.md`, local temp files (`/private/tmp/price-watch-oci.env`, `/private/tmp/price-watch-oci-compose.yml`, image tar.gz, dump sql), remote deploy dir (`/home/opc/price-watch-deploy/*`), `worklog.md`
- Result: completed with external ingress blocker (port 80 not reachable publicly)

## 2026-03-06 22:16:50 KST
- Task: Start AWS EC2 deployment of `feat/oauth-login` with Docker Compose, Nginx, and local DB migration.
- Changes:
  - Added new AWS deployment request to `requirements.md`.
  - Verified target `15.165.15.175:22` is reachable and returns an SSH banner.
  - Hit a local blocker reading `~/Downloads/price-watch.pem`; metadata is visible but file-content reads stall in the current environment, so SSH authentication could not proceed.
- Files touched: `requirements.md`, `worklog.md`
- Result: blocked (local macOS access restriction on `~/Downloads/price-watch.pem`)

## 2026-03-06 22:25:57 KST
- Task: Complete AWS EC2 deployment of `feat/oauth-login` with Docker Compose, Nginx, and local DB migration.
- Changes:
  - Confirmed SSH access as `ec2-user` to `15.165.15.175` (Amazon Linux 2023, x86_64).
  - Installed Docker Engine on EC2, added Docker Compose plugin manually, and provisioned `/swapfile` 2G.
  - Created temporary server deployment assets under `/private/tmp/price-watch-aws` (`.env`, image-based `docker-compose.yml`, `schema.mysql.sql`).
  - Built local `linux/amd64` images `price-watch-backend:aws-20260306` and `price-watch-frontend:aws-20260306`.
  - Exported/transferred image archives and local DB dump to `/home/ec2-user/price-watch-deploy` on EC2.
  - Loaded images on EC2, started `mysql/backend/frontend` containers, and imported the current local DB dump.
  - Verified service health and public access: `http://15.165.15.175/` and `http://15.165.15.175/api/health`.
  - Verified imported DB counts: `watch_item=1`, `watch_parser=10`, `watch_state=1`, `watch_check_run=368`, `watch_notification=21`, `llm_api_key=3`.
- Files touched: `requirements.md`, `worklog.md`, temporary local deploy assets (`/private/tmp/price-watch-aws/*`), remote deploy dir (`/home/ec2-user/price-watch-deploy/*`)
- Result: completed

## 2026-03-06 23:20:35 KST
- Task: Diagnose and fix Kakao-login follow-up errors on the AWS deployment.
- Changes:
  - Diagnosed `KOE006` against current code path and deployment URL: the app generates `redirect_uri` from `window.location.origin`, so the Kakao console must register `http://15.165.15.175/oauth/callback` exactly.
  - Compared deployed DB schema with `db/schema.mysql.sql` and found `watch_item.user_id` missing on the server DB imported from the older local schema.
  - Applied the user-auth migration on EC2 (`watch_item.user_id`, index, foreign key) and backfilled existing `watch_item` rows to the current user (`id=1`).
  - Verified authenticated API success by minting a JWT inside `pw-backend` and calling `/api/items` and `/api/auth/me`.
- Files touched: `requirements.md`, `worklog.md`, remote DB schema/data in `/home/ec2-user/price-watch-deploy` stack
- Result: completed

## 2026-03-06 23:34:53 KST
- Task: Add GitHub Actions CI/CD to auto-redeploy AWS EC2 on `main` pushes.
- Changes:
  - Added image-based EC2 deploy assets at `deploy/aws/docker-compose.yml` and `deploy/aws/redeploy.sh`.
  - Added workflow `.github/workflows/deploy-aws.yml` to build `linux/amd64` images on GitHub-hosted runners, upload archives to EC2, and run remote redeploy.
  - Updated `docker.readme.md` to document the `main` push redeploy flow and required GitHub Actions secrets.
  - Validated `deploy-aws.yml` YAML parsing and `redeploy.sh` shell syntax locally.
  - Manually exercised the same redeploy path against EC2 using the new deploy bundle; resulting server state: `pw-mysql`, `pw-backend`, and `pw-frontend` healthy, with public `http://15.165.15.175/` and `/api/health` responding.
- Files touched: `requirements.md`, `worklog.md`, `.github/workflows/deploy-aws.yml`, `deploy/aws/docker-compose.yml`, `deploy/aws/redeploy.sh`, `docker.readme.md`, remote deploy dir (`/home/ec2-user/price-watch-deploy/*`)
- Result: completed

## 2026-03-06 23:50:06 KST
- Task: Merge `feat/oauth-login` into `main` while prioritizing the current OAuth/LLM deployment flow during conflict resolution.
- Changes:
  - Resolved merge conflicts in favor of the current `feat/oauth-login` implementation across API, runner, schema, and watch-item UI files.
  - Excluded the unrelated tracked workspace artifact `.claude/worktrees/intelligent-hodgkin` from the merge result.
  - Validated the merged tree with backend `npm run typecheck` and frontend `npm run build`.
- Files touched: `requirements.md`, `worklog.md`, `.env.example`, `db/schema.mysql.sql`, `src/api/server.ts`, `src/api/watch-items.service.ts`, `src/config/config.service.ts`, `src/runner/scheduler.service.ts`, `src/runner/types.ts`, `src/storage/state.service.ts`, `ui/src/features/watch-item/components/AddItemModal.tsx`, `ui/src/features/watch-item/components/WatchItemCard.tsx`, `ui/src/features/watch-item/hooks/use-watch-items.ts`, `ui/src/features/watch-item/model/serializers.ts`, `ui/src/features/watch-item/model/types.ts`
- Result: completed

## 2026-03-07 00:22:39 KST
- Task: Add Let's Encrypt + Certbot HTTPS for `price-watch.duckdns.org` on the AWS EC2 deployment.
- Changes:
  - Updated frontend nginx/container config for `80 -> 443` redirect, TLS termination, `443` port exposure, and mounted certificate paths.
  - Issued a Let's Encrypt certificate on EC2 for `price-watch.duckdns.org` and mounted `/etc/letsencrypt` into `pw-frontend`.
  - Hit an ARM/AMD64 mismatch after the first local frontend rebuild, then rebuilt the frontend image explicitly for `linux/amd64` and redeployed successfully.
  - Enabled `certbot-renew.timer`, added renewal hooks to stop/start `pw-frontend`, and validated renewal with `certbot renew --dry-run --no-random-sleep-on-renew`.
  - Verified `http://price-watch.duckdns.org` redirects to HTTPS and `https://price-watch.duckdns.org/api/health` returns `{\"ok\":true}`.
- Files touched: `requirements.md`, `worklog.md`, `.env.example`, `deploy/aws/docker-compose.yml`, `deploy/aws/redeploy.sh`, `ui/Dockerfile`, `ui/nginx.conf`, remote `/etc/letsencrypt/*`, remote `/home/ec2-user/price-watch-deploy/*`
- Result: completed

## 2026-03-07 00:39:54 KST
- Task: Improve the item edit modal so the product name can be edited directly and the close button sits at the top-right.
- Changes:
  - Added a product-name input to the edit-mode step-3 form so item updates can change the displayed name without restarting the create flow.
  - Updated the modal close button label from `x` to `×` and moved modal close positioning to the actual top-right corner via shared modal styles.
  - Validated the UI build with `npm run build` in `ui/`.
- Files touched: `requirements.md`, `worklog.md`, `ui/src/features/watch-item/components/AddItemModal.tsx`, `ui/src/App.module.css`
- Result: completed

## 2026-03-07 00:46:09 KST
- Task: Commit the pending SSL and item-edit UI updates and push `main`.
- Changes:
  - Bundled the AWS HTTPS deployment updates and item edit modal improvements into the current `main` worktree.
  - Kept the local `.claude/` workspace artifacts out of git.
  - Reused the already validated frontend build as the final pre-push check.
- Files touched: `requirements.md`, `worklog.md`, `.env.example`, `deploy/aws/docker-compose.yml`, `deploy/aws/redeploy.sh`, `ui/Dockerfile`, `ui/nginx.conf`, `ui/src/App.module.css`, `ui/src/features/watch-item/components/AddItemModal.tsx`
- Result: completed

## 2026-03-07 00:48:42 KST
- Task: Remove local `.claude` worktrees and their associated local branches.
- Changes:
  - Removed `.claude/worktrees/clever-hamilton`, `.claude/worktrees/intelligent-hodgkin`, and `.claude/worktrees/pensive-shirley`.
  - Deleted local branches `claude/clever-hamilton`, `claude/intelligent-hodgkin`, and `claude/pensive-shirley`.
  - Pruned stale worktree metadata and confirmed no remaining `.claude` worktree directories.
- Files touched: `worklog.md`, local git worktree metadata
- Result: completed

## 2026-03-07 00:56:42 KST
- Task: Move the item-card delete button to the top-right corner and push `main`.
- Changes:
  - Moved the delete control out of the card action row and anchored it to the item card's top-right corner.
  - Added card-specific delete-button positioning styles without changing other delete-button usages.
  - Validated the UI with `npm run build` in `ui/`.
- Files touched: `requirements.md`, `worklog.md`, `ui/src/features/watch-item/components/WatchItemCard.tsx`, `ui/src/App.module.css`
- Result: completed

## 2026-03-07 10:08:06 KST
- Task: Restore the background worker on AWS and reduce excess item-card height.
- Changes:
  - Confirmed the deployed stack had no worker service: `pw-backend` was running only in `--api` mode, and `watch_state.last_checked_at` had stalled for about 9 hours.
  - Added a `worker` service to `deploy/aws/docker-compose.yml`, updated `deploy/aws/redeploy.sh` to recreate it, and disabled the API healthcheck for the worker container.
  - Removed the fixed `300px` card height from `ui/src/App.module.css` to eliminate unused empty space.
  - Rebuilt the frontend image for `linux/amd64`, uploaded the new deploy assets to EC2, and manually redeployed the stack.
  - Verified on EC2 that `pw-worker` is running and `watch_state.last_checked_at` advanced to `2026-03-07 01:06:18 UTC`.
- Files touched: `requirements.md`, `worklog.md`, `.env.example`, `deploy/aws/docker-compose.yml`, `deploy/aws/redeploy.sh`, `ui/src/App.module.css`, remote `/home/ec2-user/price-watch-deploy/*`
- Result: completed

## 2026-03-07 10:09:23 KST
- Task: Commit the worker-recovery/card-height updates and push `main`.
- Changes:
  - Grouped the AWS worker restore and item-card height changes into a single commit on `main`.
  - Included the updated requirement/worklog entries for the worker diagnosis and deployment follow-up.
  - Pushed the commit to `origin/main` so the deployment workflow can pick up the new compose/redeploy config.
- Files touched: `requirements.md`, `worklog.md`, `.env.example`, `deploy/aws/docker-compose.yml`, `deploy/aws/redeploy.sh`, `ui/src/App.module.css`
- Result: completed

## 2026-03-08 19:44:52 KST
- Task: Investigate Farfetch stock-status mismatch and confirm server log location.
- Changes:
  - Added the investigation request to `requirements.md` and completed it after review.
  - Traced stock-status flow through API, worker, parser persistence, and item-card UI.
  - Confirmed the fetch path uses plain server-side `fetch` and that AWS deploy logs are emitted to container stdout/stderr under Docker Compose.
  - Confirmed the local DB has no Farfetch watch item, so the live mismatch is on the deployed/server dataset rather than local state.
- Files touched: `requirements.md`, `worklog.md`
- Result: completed

## 2026-03-08 19:56:59 KST
- Task: Check the deployed AWS data for the Farfetch stock mismatch and verify whether runtime is a Nest HTTP server.
- Changes:
  - Added the new server-inspection request to `requirements.md`.
  - Confirmed from code and image config that the API container starts with `node dist/main.js --api`, while the worker uses the Nest application context path.
  - Attempted direct SSH to `ec2-user@15.165.15.175` twice from the current environment; both attempts timed out on port `22`, so the live DB rows could not be inspected.
  - Verified the public deployment still responds at `https://price-watch.duckdns.org/api/health`.
- Files touched: `requirements.md`, `worklog.md`
- Result: blocked (SSH/network access to AWS server unavailable from current environment)

## 2026-03-09 21:12:54 KST
- Task: Diagnose the `307` error on the `RRL lot 271 black` item and improve failure diagnostics.
- Changes:
  - Confirmed the local watch item `118dc63f-5dfe-4118-a667-1502875e5d84` was failing repeatedly with `HTTP 307 Forbidden` in `watch_check_run`.
  - Reproduced the response from `www.ralphlauren.co.kr` and identified the body as a `PerimeterX` access-denied page rather than the product page.
  - Added `HttpFetchError` classification in the fetcher so blocked/HTTP error responses include the page title and anti-bot marker in the stored error message.
  - Propagated fetch error metadata through the scheduler and API check path so failed checks retain the response content type and worker check runs can store the HTTP status.
  - Verified with `npm run typecheck` and repeated fetcher probes after the change.
- Files touched: `requirements.md`, `worklog.md`, `src/fetchers/http-fetcher.service.ts`, `src/runner/scheduler.service.ts`, `src/api/server.ts`
- Result: completed

## 2026-03-09 21:12:54 KST
- Task: Implement a stable browser-backed fetch fallback for anti-bot protected product pages.
- Changes:
  - Added `playwright-core` and browser executable auto-detection so the fetcher can fall back to a real Chromium/Chrome instance when plain HTTP is blocked.
  - Updated `HttpFetcherService` to use browser-like HTTP headers, detect anti-bot responses even on `200`, and retry via a shared headless browser before failing.
  - Added browser cleanup to the API server shutdown path and installed Chromium in the production Docker image.
  - Added optional `BROWSER_EXECUTABLE_PATH` documentation to `.env.example`.
  - Verified with `npm run typecheck`, `npm run build`, and repeated fetches against the Ralph Lauren KR product page returning the real product HTML.
- Files touched: `requirements.md`, `worklog.md`, `package.json`, `package-lock.json`, `Dockerfile`, `.env.example`, `src/fetchers/http-fetcher.service.ts`, `src/api/server.ts`
- Result: completed

## 2026-03-09 21:37:57 KST
- Task: Deploy the anti-bot browser-fallback changes to AWS.
- Changes:
  - Added the deploy request to `requirements.md`.
  - Committed the fetch fallback changes on `main` as `761d12b` (`feat: add browser fallback for blocked product pages`) and pushed to `origin/main`.
  - Triggered the existing GitHub Actions workflow `Deploy AWS EC2` and confirmed run `#6` completed successfully for commit `761d12b017ab5f008ddb230e8f3b9b1bfbd4d438`.
  - Confirmed the deployment job `Build and Redeploy to EC2` completed successfully and the public health endpoint still returns `{\"ok\":true}`.
- Files touched: `requirements.md`, `worklog.md`, git history
- Result: completed

## 2026-03-09 21:54:14 KST
- Task: Diagnose the Farfetch sold-out mismatch and prevent unknown stock from appearing purchasable.
- Changes:
  - Reconfirmed the likely mismatch path in code: LLM parser save could persist `is_out_of_stock = 0`, and later checks could leave that stale value in place when stock was not actually detectable.
  - Changed the LLM test-run logic to leave stock as unknown unless a stock parser or target-size parser produced evidence.
  - Updated the worker check path to clear stale stock/size state before each successful parse so unknown results no longer keep an old `false`.
  - Updated API check persistence so successful checks write `NULL` for unknown stock instead of preserving the previous value.
  - Updated the item-card UI to show `재고 미확인` for size-tracked items with unknown stock, instead of presenting them like normal purchasable items.
  - Verified with backend `npm run typecheck` and frontend `cd ui && npm run build`.
- Files touched: `requirements.md`, `worklog.md`, `src/llm/parser-generator.service.ts`, `src/runner/scheduler.service.ts`, `src/api/watch-items.service.ts`, `ui/src/features/watch-item/components/WatchItemCard.tsx`, `ui/src/App.module.css`
- Result: completed

## 2026-03-09 22:02:51 KST
- Task: Deploy the Farfetch stale-stock fix to AWS.
- Changes:
  - Added the deploy request to `requirements.md`.
  - Committed the stale-stock fix on `main` as `72b2760` (`fix: clear stale stock state for unknown size results`) and pushed to `origin/main`.
  - Triggered GitHub Actions workflow `Deploy AWS EC2` run `#7` for commit `72b2760e2d12d54dbb92cad99318eac0f49f80c9`.
  - Confirmed the workflow reached `Redeploy on EC2` and then failed; public `https://price-watch.duckdns.org/api/health` still returns `{\"ok\":true}`, indicating the previous deployment remains serving traffic.
  - Could not retrieve the failing step logs from the GitHub API without authentication; documented as the current blocker.
- Files touched: `requirements.md`, `worklog.md`, git history
- Result: blocked (AWS redeploy step failed; detailed remote logs unavailable from current environment)

## 2026-03-09 22:09:19 KST
- Task: Add a Ralph Lauren-specific mirror fallback so Polo pages can still be parsed when both HTTP and browser fetches are anti-bot blocked.
- Changes:
  - Investigated the blocked Ralph Lauren product and variation URLs and confirmed both plain HTTP and browser fallback were still receiving PerimeterX denial pages.
  - Verified that the remote mirror endpoint `r.jina.ai` can fetch the same Ralph Lauren pages and expose size/price state in markdown.
  - Added a Ralph Lauren-only remote mirror fallback in `HttpFetcherService` after browser fallback failure, and transformed mirror markdown into pseudo-HTML so the existing Ralph Lauren regex parsers still work.
  - Verified with `npm run typecheck`, `npm run build`, and direct fetch tests against the blocked `Product-Variation` URL showing `price=519000` and `M` parsed as out of stock.
- Files touched: `requirements.md`, `worklog.md`, `src/fetchers/http-fetcher.service.ts`
- Result: completed
