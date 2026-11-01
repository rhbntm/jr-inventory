# Developer Guide — J&R Inventory

How to run, test and deploy the app. Commands are for PowerShell on the Windows dev PC, run from the project folder.

---

## Quick start (every time)

1. Open Docker Desktop and wait until it says it's running.
2. Check the database is up, and start it if it isn't:
   ```powershell
   docker start jr-inventory-db-1
   ```
3. Start the app:
   ```powershell
   npm run dev
   ```
4. Open http://localhost:3000.

If you pulled new code or switched branches, run these before `npm run dev`:

```powershell
npm install
npx prisma migrate deploy
```

---

## What runs where

| Part | On this PC | On the VPS |
|---|---|---|
| **App** | Your terminal, via `npm run dev` (not in Docker) | Docker container `app` |
| **Database** | Container `jr-inventory-db-1`, on port 5435 | Docker container `db` |
| **Tailscale** (makes the app reachable online) | Not used | Docker container `tailscale` |

There are two Compose files:

| File | Purpose | What it starts |
|---|---|---|
| `docker-compose.dev.yml` | Local development | Database only |
| `docker-compose.yml` | Production on the VPS | Database, app and Tailscale |

**On this PC, only `jr-inventory-db-1` should be running.** Seeing no app container in Docker during development is normal.

`jr-inventory-app-1` and `jr-inventory-tailscale-1` are leftovers from running the production file on this PC. They aren't the database or the server you're developing against. If they keep starting with Docker, turn that off:

```powershell
docker update --restart=no jr-inventory-app-1 jr-inventory-tailscale-1
```

---

## First-time setup (new PC or fresh clone)

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Create `.env` in the project folder. It's ignored by git, and there's no example file, so use this:
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=jr_inventory
   DATABASE_URL="postgresql://postgres:postgres@localhost:5435/jr_inventory?schema=public"
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=<paste a generated value>
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```
   Generate the secret with:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   The Google values are only needed for Google sign-in. A password login is enough locally. `TS_AUTHKEY` and `TS_HOSTNAME` are for the VPS only.
3. Start the database:
   ```powershell
   docker compose -f docker-compose.dev.yml up -d db
   ```
4. Create the tables:
   ```powershell
   npx prisma migrate deploy
   ```
5. Create your login:
   ```powershell
   npm run create-user -- --email you@example.com --name "Your Name" --role OWNER --password "at-least-8-chars"
   ```
6. Start the app:
   ```powershell
   npm run dev
   ```

Forgot your password? Run the `create-user` command again with `--update` added.

---

## Running the tests

The tests **delete all data** in their database. They read `.env.test`, not `.env`, and refuse to run unless the database name ends in `_test`.

The database container must be running. Then:

```powershell
npx vitest run
```

`npm test` does the same thing but keeps watching for file changes. Press `q` to quit.

### First-time test setup, or after adding a migration

Create `.env.test` if it's missing:

```powershell
Copy-Item .env.test.example .env.test
```

Create the test database if it's missing. It's fine if this says the database already exists:

```powershell
docker compose -f docker-compose.dev.yml exec db createdb -U postgres jr_inventory_test
```

Bring its tables up to date:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5435/jr_inventory_test?schema=public"
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
```

Don't skip the last line. Until it runs, every command in that terminal uses the test database, so `npm run dev` would too.

---

## Changing the database structure

1. Edit `prisma/schema.prisma`.
2. Create the migration, which also applies it to your local database:
   ```powershell
   npx prisma migrate dev --name short_description
   ```
3. Update the test database (see above).
4. Commit the new folder in `prisma/migrations` along with your code.

To browse local data in a web page, run `npx prisma studio`.

---

## Before you deploy

Run these and make sure they all pass:

```powershell
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```

Then click through whatever you changed at http://localhost:3000, including at phone width. The app is mostly used on phones.

---

## Deploying to the VPS

**Pushing or merging to `main` deploys straight away.** There's no extra step or confirmation.

1. Work on a branch, never directly on `main`.
2. Commit and push the branch, then open a pull request.
3. Merge it into `main`.
4. GitHub Actions (`.github/workflows/deploy.yml`) connects to the VPS, pulls the code and rebuilds the `app` container.
5. Migrations run automatically when the new container starts (`docker-entrypoint.sh`).
6. A Discord message arrives when the container has been rebuilt and started. If none arrives, check the **Actions** tab on GitHub. The message doesn't prove the app is working, so open the live site and check it loads.

### Back up first if the deploy includes a migration

Migrations run against real data, and there's no automatic undo. On the VPS:

```bash
bash /home/brent/jr-inventory/backup-db.sh
```

### Useful commands on the VPS

Docker on the VPS is rootless, so set this first in each SSH session:

```bash
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
cd /home/brent/jr-inventory
docker compose ps
docker compose logs -f app
```

To restore a backup:

```bash
gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U postgres jr_inventory
```

---

## Be careful with these

| Don't | Why |
|---|---|
| Run plain `docker compose up` on this PC | It starts the production setup. Always add `-f docker-compose.dev.yml`. |
| Run `docker compose down -v` | `-v` deletes the database volume and all your local data. |
| Forward port 5435 from the VPS while developing | `.env` points at that port, so the local app and `migrate deploy` could change whichever database the forward reaches. |
| Use **Settings → Reset** unless you mean it | It permanently deletes all sales, batch and reservation history, and a full reset deletes products too. Check which site you're on first. |
| Push experiments to `main` | Every push to `main` goes live. |

### Check that port 5435 is really local

Do this if anything seems off, and before running migrations:

```powershell
Get-NetTCPConnection -LocalPort 5435 -State Listen | ForEach-Object { (Get-Process -Id $_.OwningProcess).ProcessName }
```

| Result | Meaning | What to do |
|---|---|---|
| `wslrelay`, `com.docker.backend` | Your local Docker database | Safe to continue |
| `Code` | A VS Code port forward, probably to another machine | Stop. Remove it in VS Code's **Ports** panel, then check again |
| Nothing | The database isn't running | Run `docker start jr-inventory-db-1` |

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Pages load but show errors, no data, or saves fail | Database isn't running | `docker start jr-inventory-db-1`, then restart `npm run dev` |
| Docker shows `jr-inventory-app-1` restarting | Old production container on this PC | Ignore it, or turn it off with the `docker update` command above |
| `exec ./docker-entrypoint.sh: no such file or directory` | That same old container | Same as above. You don't need it locally |
| Errors about a missing column or table | Migrations not applied | `npx prisma migrate deploy` |
| Tests fail with `Hook timed out` | Test database isn't reachable | Start the database and check port 5435 |
| Tests fail because of a missing column | Test database is behind | Update it (see **Running the tests**) |
| `Port 3000 is in use`, or the app won't start | `npm run dev` is already running in another terminal | Close that one, or use the one that's open |
| Too many login attempts | 5 failed tries blocks that email for up to 30 minutes | Wait, or restart `npm run dev` locally, since the count is kept in memory |
| Google sign-in says you're not invited | Sign-in is invite-only | Add your email with `npm run create-user`, or in **Settings → Users** |
| Code changes don't seem to apply | Stale dev server | Stop `npm run dev` and start it again |

---

## Related docs

- [`README.md`](../README.md) — Project overview
- [`CONTEXT.md`](../CONTEXT.md) — Business terms used in the code
- [`bale-counting-guide.md`](./bale-counting-guide.md) — Receiving a bale, for the shop side
