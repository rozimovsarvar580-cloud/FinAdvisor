# FinAdvisor Web

Next.js 14 App Router application using TypeScript and Tailwind CSS.

From the repository root, run `npm install`, then `npm run dev --workspace apps/web`.
Visit `http://localhost:3000/uz`.

Set `NEXTAUTH_SECRET` and `JWT_SECRET` in the repository `.env` file. Google and
Facebook sign-in are enabled when their corresponding client ID and secret are
configured. OAuth sign-in exchanges the provider access token with FastAPI;
email/password authentication is also handled by the API. Configure
`FINADVISOR_API_URL` when the API is not running at `http://127.0.0.1:8000`.

Checks: `npm run lint --workspace apps/web`, `npm test --workspace apps/web`,
`npm run test:e2e --workspace apps/web`, and
`npm run build --workspace apps/web`. Playwright's Chromium browser must be
installed with `npx playwright install chromium`.
