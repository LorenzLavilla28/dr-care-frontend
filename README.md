# Dr. Care Operations Frontend

React/Vite internal operations workspace for the Dr. Care Medical Group franchise process.

## Run locally

```powershell
npm install
npm run dev
```

The frontend uses the Docker API at `http://localhost:8080` by default. Copy `.env.example` to `.env.local` when the API runs somewhere else.

## Product structure

- Command center and pipeline views for daily work.
- Lead workspaces for inquiry, activities, documents, finance, contracts, pre-launch, handoff, and audit history.
- Role-aware navigation that still relies on the API for authorization.
- API client methods for the complete `/api/v1` surface in `src/api.ts`.

## Security baseline

See [SECURITY.md](SECURITY.md) for the client-side security decisions and production hosting headers.
