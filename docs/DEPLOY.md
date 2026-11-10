---
noteId: "3966d140dd1411f1a2f42f39c6285f96"
tags: []

---

# Staging and production deployment

This guide covers the deployment workflow in [deploy.yml](../.github/workflows/deploy.yml) and the
production stack in [docker-compose.prod.yml](../docker-compose.prod.yml). Staging is a real deployment,
but it should use isolated infrastructure, test accounts, and sandbox credentials. Do not copy production
data or secrets into staging.

## 1. Prepare the host

Provision a Linux server reachable by the GitHub Actions runner over SSH. Install Docker Engine and the
Docker Compose v2 plugin using Docker's official installation instructions. Create a dedicated deploy
account and a deployment directory (the workflow defaults to `/opt/finadvisor`). The account needs to run
Docker Compose; membership in the Docker group grants root-equivalent access, so restrict this account and
its SSH key.

Allow inbound TCP ports 80 and 443 and UDP port 443 for Caddy's HTTP/HTTPS and HTTP/3 traffic. Restrict SSH
to the runner or a trusted network; the workflow uses GitHub-hosted runners, whose address ranges change.
Use a controlled runner/network path if the host firewall cannot safely allow those ranges. Do not expose
the API, PostgreSQL, or Redis ports publicly.

Create a separate host and data volumes for staging and production where possible. If sharing a host, use
different deployment directories and domains so Compose creates separate projects and persistent volumes.
Keep sufficient disk space for database data, Docker images, and backups; follow the backup and restore
instructions in [RUNBOOK.md](./RUNBOOK.md).

## 2. Configure DNS and TLS

Choose a staging domain, for example `staging.example.com`, and configure DNS:

- Point an `A` record for the site domain to the host's public IPv4 address.
- Point `api.<site-domain>` to the same host.
- Add `AAAA` records only if the host is reachable over IPv6.

Repeat with a distinct production domain. Caddy obtains and renews certificates automatically. Before
deploying, confirm that both names resolve to the host, ports 80 and 443 are reachable, and no other
service is occupying those ports. Keep the Compose-managed `caddy_data` volume; deleting it discards
Caddy's certificate state.

## 3. Provision deployment files and environment

Check out the repository into the deployment directory once, so it contains `docker-compose.prod.yml` and
`Caddyfile`. Keep those files synchronized with the commit or release being deployed. The GitHub workflow
builds and deploys container images; it does **not** copy or update these host-side files. When updating
them, preserve the untracked runtime environment file and validate the Compose configuration before
deploying.

Create a host-side `.env` in the deployment directory, readable only by the deploy account (`chmod 600
.env`). Do not commit it, put secrets in workflow variables, or paste its contents into logs or tickets.
Generate unique random secrets for each environment and enter values using a secure editor or secret
manager. The following variables are required by the production Compose file:

| Variable | Purpose |
| --- | --- |
| `SITE_DOMAIN` | Site hostname; Caddy also serves `api.$SITE_DOMAIN`. |
| `POSTGRES_PASSWORD` | Password for the Compose PostgreSQL role. |
| `DATABASE_URL` | API connection URL to the Compose database, for example `postgresql+psycopg://finadvisor:<URL-encoded-password>@postgres:5432/finadvisor`. It must use the same database, user, and password configured for PostgreSQL. |
| `JWT_SECRET` | Long, random API signing secret. |
| `NEXTAUTH_SECRET` | Long, random web session secret. |

Use a URL-encoded database password in `DATABASE_URL` if it contains URL-reserved characters. The database
host in this URL must be `postgres`, the Compose service name, not `localhost`.

Optional variables accepted by the stack include:

- `OPENAI_API_KEY` and `OPENAI_MODEL` for backend AI features. The key is server-side only; never put it in
  web build arguments, client code, or logs.
- `INTERNAL_API_KEY`, `SENTRY_DSN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, and
  `FACEBOOK_CLIENT_SECRET`.
- `EMAIL_PROVIDER`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`, and
  `RESEND_API_KEY`.
- `PAYMENT_PROVIDER`, `PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY`, and `PAYMENT_WEBHOOK_SECRET`.

Unset optional integrations remain disabled or unavailable according to their application configuration.
For staging, use provider sandbox credentials. Configure callback and webhook URLs with the staging
domains where the provider requires them. Do not treat staging checkout or email as production delivery.

Before the first deployment, check the Compose file without printing environment values:

```sh
docker compose -f docker-compose.prod.yml config --quiet
```

## 4. Configure GitHub Actions

In repository **Settings → Secrets and variables → Actions**, add variables:

- `STAGING_SITE_DOMAIN`: staging site's domain, without a scheme or path.
- `PRODUCTION_SITE_DOMAIN`: production site's domain, without a scheme or path.

Create GitHub environments named `staging` and `production`. For each environment, add variable
`SITE_DOMAIN` and the secrets below:

- `DEPLOY_HOST`: SSH hostname or IP address.
- `DEPLOY_USER`: dedicated remote deploy account.
- `DEPLOY_SSH_KEY`: private key for that account.
- `DEPLOY_KNOWN_HOSTS`: verified host public-key line(s), in known-hosts format.

Optionally set environment variable `DEPLOY_PATH` if the files are not under `/opt/finadvisor`. Verify the
server's SSH host key through a trusted channel before adding it to `DEPLOY_KNOWN_HOSTS`; do not disable
host-key checking or trust an unverified scan. The server must also be able to pull the repository's GHCR
images. Configure a read-only GHCR package credential on the host using a protected credential store;
the deployment workflow does not transfer a registry password to the server.

Protect the `production` environment with required reviewers in GitHub settings. The workflow file alone
cannot enforce reviewer approval. Restrict who can create release tags and who can change environment
secrets.

## 5. First deployment

1. Verify DNS, firewall access, host-side Compose/Caddy files, the private runtime environment file, and
   GHCR pull access. Confirm the staging GitHub environment and repository variables are set.
2. Push the intended deployment commit to `main`. The workflow runs `node scripts/verify.mjs`, builds and
   pushes the API and web images, then connects to the staging host.
3. The workflow pulls the images, waits for PostgreSQL and Redis, runs Alembic migrations, starts the API,
   scheduler, and web services, and then starts Caddy.
4. In the Actions run, confirm the deploy job succeeds. From a trusted client, check:

   ```sh
   curl --fail https://api.staging.example.com/ready
   curl --fail --head https://staging.example.com/
   ```

   Replace the example hostnames with the staging domains. The API readiness response must be healthy,
   HTTPS must present a valid certificate, and the site's response must succeed. Review container health
   and logs on the host if a check fails; redact credentials and personal data before sharing logs.
5. Exercise the staging flows using test accounts and sandbox integrations. Do not announce production
   readiness from a successful container health check alone.
6. To enable the landing-page demo, seed its clearly labeled sample account once:

   ```sh
   docker compose -f docker-compose.prod.yml exec -T api python -m finadvisor_api.seed_demo
   ```

   The command is safe to repeat and refuses to take over an existing non-demo account.

Push a version tag matching `v*` to build and deploy a release to the `production` environment. GitHub
pauses that job for the environment's required approval, if configured. Ensure the production host files,
secrets, DNS, and image-pull permissions are ready before approving.

## 6. Rollback

If a deployment fails, inspect the Actions log and host health first. Do not delete database volumes or
restore a backup as an application rollback.

1. Identify the last known-good image tags from a successful deployment or release. Keep both API and web
   tags from the same deployment.
2. Re-run the workflow for the known-good commit or release tag, following the normal approval process.
   The workflow deploys the images produced for that ref. If a rapid manual rollback is necessary, on the
   host set `FINADVISOR_API_IMAGE` and `FINADVISOR_WEB_IMAGE` to the known-good GHCR image references and
   run the normal Compose pull and service update steps from the workflow. Do not use a floating `latest`
   tag.
3. Check `https://api.<site-domain>/ready`, the website, and service health. Review logs for migration or
   compatibility errors.
4. Database migrations may not be reversible by changing images. If a migration caused data loss or
   corruption, stop writes, preserve the current database state, and follow the controlled restore
   procedure in [RUNBOOK.md](./RUNBOOK.md). Confirm the target database and backup before restoring.

Document the release, symptoms, rollback result, and follow-up actions without recording secrets.
