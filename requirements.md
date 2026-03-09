# Requirements

## 2026-03-02 14:55:09 KST
- Request: Create project-root `AGENTS.md` for this repository.
- Required policy:
  - Write work execution records in `worklog.md`.
  - Write user-requested tasks in `requirements.md`.
  - Report and get user review before executing work.
- Status: done

## 2026-03-02 14:55:09 KST
- Request: Refactor frontend to split `ui/src/App.tsx` by project-fit pattern and commit in work units.
- Expected result:
  - Keep behavior while separating concerns into feature-centric files.
  - Make commits in meaningful units.
- Status: done

## 2026-03-02 15:42:37 KST
- Request: Split all remaining local changes into work-unit commits and push everything.
- Expected result:
  - Group remaining modified/untracked/deleted files by task.
  - Commit each group with clear message.
  - Push commits to `origin/main`.
- Status: done

## 2026-03-05 23:49:00 KST
- Request: Merge `feat/docker-cicd` into current branch, follow `docker.readme.md`, and deploy to OCI server `134.185.106.60` using SSH key `~/.ssh/id_ed25519_personal`.
- Status: done

## 2026-03-06 00:05:50 KST
- Request: Continue OCI deployment on a fresh server and import current local DB data into the server DB.
- Status: done

## 2026-03-06 00:21:40 KST
- Request: Switch to low-spec-safe deployment strategy (no server build, add swap) and continue deployment with local DB migration.
- Status: done

## 2026-03-06 20:04:19 KST
- Request: Deploy `feat/oauth-login` branch to OCI server `134.185.106.60` with the existing low-spec-safe flow.
- Status: approved

## 2026-03-06 20:16:34 KST
- Request: Stop Docker-based deployment and redeploy `feat/oauth-login` by uploading built artifacts directly to server.
- Status: approved

## 2026-03-06 21:33:27 KST
- Request: Deploy the current local `feat/oauth-login` state to the OCI server using a non-Docker flow and local data.
- Status: approved

## 2026-03-06 22:11:47 KST
- Request: Deploy the current local `feat/oauth-login` state to AWS EC2 `15.165.15.175` with Docker Compose and Nginx, using `~/Downloads/price-watch.pem`, and migrate local DB data.
- Status: done

## 2026-03-06 22:28:03 KST
- Request: Diagnose Kakao login error `KOE006` on the AWS-deployed app and identify the required Kakao console settings for the current deployment URL.
- Status: done

## 2026-03-06 23:17:59 KST
- Request: Fix the post-login AWS error `Unknown column 'w.user_id' in 'where clause'` on the deployed app.
- Status: done

## 2026-03-06 23:30:39 KST
- Request: Set up CI/CD so pushes to `main` automatically redeploy the AWS EC2 server via GitHub Actions.
- Status: done

## 2026-03-06 23:41:27 KST
- Request: Commit all current work and merge it into `main`.
- Status: done

## 2026-03-06 23:46:45 KST
- Request: Merge into `main` while prioritizing the current `feat/oauth-login` functionality when resolving conflicts.
- Status: done

## 2026-03-07 00:11:21 KST
- Request: Configure Let's Encrypt + Certbot SSL for `price-watch.duckdns.org` on the AWS EC2 deployment.
- Status: done

## 2026-03-07 00:33:40 KST
- Request: Allow editing the product name directly in the item edit flow and move the modal close `X` button to the top-right.
- Status: done

## 2026-03-07 00:45:33 KST
- Request: Commit the pending SSL and item-edit UI changes, then push `main` so deployment can proceed.
- Status: done

## 2026-03-07 00:55:26 KST
- Request: Move the `X` delete button on each item card to the top-right corner.
- Status: done

## 2026-03-07 10:03:01 KST
- Request: Verify whether the background worker is actually running for registered items and reduce excess empty space by shrinking the item card height.
- Status: done

## 2026-03-07 10:09:14 KST
- Request: Commit the worker-recovery and card-height changes, then push `main`.
- Status: done

## 2026-03-08 19:44:52 KST
- Request: Investigate why the Farfetch item shows in stock in Price Watch and identify where server logs are stored.
- Status: done

## 2026-03-08 19:56:59 KST
- Request: Check the deployed server data for the Farfetch stock-status mismatch and confirm whether the app is currently running as a Nest server.
- Status: approved

## 2026-03-09 21:12:54 KST
- Request: Investigate the `307` error occurring for the `RRL lot 271 black` item.
- Status: done

## 2026-03-09 21:12:54 KST
- Request: Implement a stable fetch strategy for anti-bot protected product pages.
- Status: done

## 2026-03-09 21:37:57 KST
- Request: Deploy the anti-bot browser-fallback changes to the AWS environment.
- Status: done

## 2026-03-09 21:54:14 KST
- Request: Verify why the Farfetch item still shows purchasable when size M is currently sold out.
- Status: done

## 2026-03-09 22:02:51 KST
- Request: Deploy the Farfetch stale-stock fix to the AWS environment.
- Status: approved

## 2026-03-09 22:09:19 KST
- Request: Fix the persistent Polo/Ralph Lauren anti-bot fetch failure and complete deployment of all pending related changes.
- Status: approved
