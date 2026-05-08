# QR Code Generator — Exercise

```bash
cd scaffold
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Files to Fill In

| File | TODO | Design Decision |
|------|------|-----------------|
| `app/token_gen.py` | `generate_token()` | How to generate unique, URL-safe short tokens |
| `app/url_validator.py` | `validate_url()` | URL normalization and malicious URL blocking |
| `app/routes.py` | `redirect()` | Cache → DB lookup → 410/404 fallback flow |

### Run and Verify

```bash
uvicorn app.main:app --reload
```

Then run the verification tests from `PROMPT.md`.

## Docker App Stack

The full app can run with Next.js, FastAPI, PostgreSQL, and Redis through Docker
Compose:

```bash
docker compose up --build
```

Services:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

The frontend runs `npm run dev` in Docker. It proxies `/api/*` to the API
service through `INTERNAL_BACKEND_BASE_URL`, while browser-visible links still
use `NEXT_PUBLIC_BACKEND_BASE_URL`.

The API reads `DATABASE_URL`, `REDIS_URL`, and `PUBLIC_BASE_URL` from the Compose
environment. For non-Docker local development, copy `backend/.env.example` and
export those variables before starting uvicorn.

### ngrok

To expose the API and QR redirect URLs through ngrok, set your ngrok auth token
and start the optional profile:

```bash
export NGROK_AUTHTOKEN=your_token_here
export PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
docker compose --profile ngrok up --build
```

The ngrok agent tunnels directly to the API service. The frontend still runs at
http://localhost:3000 for local management, while generated QR codes and API docs
use the public `PUBLIC_BASE_URL`.

You can inspect the ngrok agent locally at http://localhost:4040.

## Bonus Challenges

- Build a simple frontend (input URL → display QR code image)
- Add rate limiting to the create endpoint
- Add expiration support with automatic 410 responses
