# EV Battery Health Estimator

A web tool that forecasts how an electric vehicle battery will age based on vehicle, climate and
charging habits. The forecast comes from a physics-based electrochemical model (PyBaMM).
It also tells you when a pack becomes a candidate for second-life grid storage.

```
 Browser ──► Cloudflare Pages (static Next.js, free, unmetered bandwidth)
                │  fetch()
                ▼
           Google Cloud Run (FastAPI + PyBaMM container, scales to zero)
                │
                ├─ in-memory LRU cache (identical inputs → instant)
                └─ PyBaMM: SPM + SEI + lithium plating, 365 simulated days (~3-9 s)
```

## Project layout

```
backend/
  app/main.py         FastAPI routes, CORS, cache, rate limit
  app/simulation.py   PyBaMM model, experiment builder, fit + extrapolation
  app/schemas.py      Request/response models (validation + cache key)
  app/presets.py      Vehicles and climates
  app/config.py       Env-var settings (calibration factor, rate limit...)
  tests/              pytest suite
  Dockerfile
frontend/
  app/                Next.js App Router pages (/ and /about)
  components/         Estimator form + Recharts SoH chart
  lib/api.ts          Typed API client
.github/workflows/ci.yml
```

## Run locally

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
pytest -q                                            # ~20 s, runs real simulations
```

API docs: http://localhost:8080/docs

**Frontend** (Node 20+):

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

## How the model works

1. **Representative day.** Daily km × vehicle efficiency ÷ pack size gives depth of discharge.
   Charger power ÷ pack size gives the charge C-rate. Because everything is in C-rates, the same
   model covers a hatchback and a city bus.
2. **One simulated year.** There are 365 drive → park → charge cycles, with the ambient temperature
   changing monthly. With thermal management on, the pack is held at 15–30 °C while driving and charging,
   but sits at ambient temperature while parked. Charging stops at the voltage that corresponds to the
   target state of charge, the same way a real charger does. Without that, the state of charge drifts
   down over the year and underestimates high-SoC aging. "100 %" maps to 95 % of the cell window, as a
   top buffer.
3. **Physics.** The model is PyBaMM's Single Particle Model with solvent-diffusion-limited SEI growth
   and partially reversible lithium plating, using the `OKane2022` parameter set (LG M50, NMC811).
4. **Extrapolation.** Loss of lithium inventory over days 30–365 is fitted to
   `a·√t + b·t + c` using non-negative least squares. The √t term is SEI growth and the linear term is
   per-cycle damage. The fit is then extended to the requested number of years.
5. **Calibration.** `SoH = 100 − CALIBRATION_FACTOR × LLI`. See below.

### Calibration

The model only captures lithium-inventory loss. Real packs also lose active material, so the raw
model under-predicts fade. With the default `CALIBRATION_FACTOR` of 1.8, a mid-size EV reaches
about 90–95 % SoH after 10 years. Published fleet data is closer to 80–85 %, so **absolute numbers are
optimistic until you calibrate**. The relative effects (climate, charge target, fast charging,
thermal management) already point the right way. To make it defensible:

1. Collect real-world SoH vs age data, for example from public fleet studies (Geotab and Recurrent
   publish EV battery aging data) or from city transit agencies' electric bus reports.
2. Run the estimator for matching conditions and fit the factor, or better, fit the SEI and
   plating parameters directly, by minimising the error.
3. Report the validation error on the About page.

## Deploy

### Backend → Google Cloud Run (free tier, scales to zero)

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
cd backend
gcloud run deploy battery-api \
  --source . \
  --region us-central1 \
  --cpu 2 --memory 2Gi \
  --concurrency 2 \
  --min-instances 0 --max-instances 3 \
  --timeout 60 \
  --set-env-vars CORS_ORIGINS=https://YOUR-SITE.pages.dev,WORKERS=2 \
  --allow-unauthenticated
```

- `--max-instances 3` is cost ceiling. Traffic beyond that waits or gets errors.
- Cold start takes a few seconds. The front end calls `/api/presets` on page load to wake the
  instance while the user fills in the form.

### Frontend → Cloudflare Pages

1. Push the repo to GitHub.
2. In Cloudflare: Workers & Pages → Create → Pages → connect the repo.
3. Set the root directory to `frontend`, the build command to `npm run build`, and the output
   directory to `out`.
4. Add the environment variables `NEXT_PUBLIC_API_URL=https://battery-api-xxxx.run.app` and
    `NEXT_PUBLIC_SUPPORT_URL`.
   
### Support link (Stripe)

Create a Stripe **Payment Link** with "Let customers choose what to pay". No code or backend is
needed. Paste the URL into `NEXT_PUBLIC_SUPPORT_URL` and the footer shows "Support the project".


The input rounding in `EstimateRequest.cache_key()` (5 km, 5 % steps) is what keeps the cache hit
rate high.

## Credits

- PyBaMM: Sulzer et al., *Journal of Open Research Software* (2021)
- OKane2022 parameters: O'Kane et al., *PCCP* (2022)
- Inspired by Teixeira & da Silva, "Simulating Electric-Vehicle Battery Degradation with Physics
  Based Battery Model"
