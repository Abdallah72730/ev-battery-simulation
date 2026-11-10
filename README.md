EV Battery Health Estimator
A web tool that forecasts how an electric vehicle battery will age based on vehicle, climate and
charging habits. The forecast comes from a physics-based electrochemical model (PyBaMM), not a rule of thumb.
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
Project layout
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
Run locally
Backend (Python 3.11+):
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
pytest -q                                            # ~20 s, runs real simulations
```
API docs: http://localhost:8080/docs
Frontend (Node 20+):
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```
How the model works
Representative day. Daily km × vehicle efficiency ÷ pack size gives depth of discharge.
Charger power ÷ pack size gives the charge C-rate. Because everything is in C-rates, the same
model covers a hatchback and a city bus.
One simulated year. There are 365 drive → park → charge cycles, with the ambient temperature
changing monthly. With thermal management on, the pack is held at 15–30 °C while driving and charging,
but sits at ambient temperature while parked. Charging stops at the voltage that corresponds to the
target state of charge, the same way a real charger does. Without that, the state of charge drifts
down over the year and underestimates high-SoC aging. "100 %" maps to 95 % of the cell window, as a
top buffer.
Physics. The model is PyBaMM's Single Particle Model with solvent-diffusion-limited SEI growth
and partially reversible lithium plating, using the `OKane2022` parameter set (LG M50, NMC811).
Extrapolation. Loss of lithium inventory over days 30–365 is fitted to
`a·√t + b·t + c` using non-negative least squares. The √t term is SEI growth and the linear term is
per-cycle damage. The fit is then extended to the requested number of years.
Calibration. `SoH = 100 − CALIBRATION_FACTOR × LLI`. See below.
Calibration (the next step for the research side)
The model only captures lithium-inventory loss. Real packs also lose active material, so the raw
model under-predicts fade. With the default `CALIBRATION_FACTOR` of 1.8, a mid-size EV reaches
about 90–95 % SoH after 10 years. Published fleet data is closer to 80–85 %, so absolute numbers are
optimistic until you calibrate. The relative effects (climate, charge target, fast charging,
thermal management) already point the right way. To make it defensible:
Collect real-world SoH vs age data, for example from public fleet studies (Geotab and Recurrent
publish EV battery aging data) or from city transit agencies' electric bus reports.
Run the estimator for matching conditions and fit the factor, or better, fit the SEI and
plating parameters directly, by minimising the error.
Report the validation error on the About page. That turns this from a demo into a research result.
Deploy
Backend → Google Cloud Run (free tier, scales to zero)
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
`--max-instances 3` is your cost ceiling. Traffic beyond that waits or gets errors instead of
costing you money. Also set a budget alert in Google Cloud Billing.
Cold start takes a few seconds. The front end calls `/api/presets` on page load to wake the
instance while the user fills in the form.
Frontend → Cloudflare Pages
Push the repo to GitHub.
In Cloudflare: Workers & Pages → Create → Pages → connect the repo.
Set the root directory to `frontend`, the build command to `npm run build`, and the output
directory to `out`.
Add the environment variables `NEXT_PUBLIC_API_URL=https://battery-api-xxxx.run.app` and
(optionally) `NEXT_PUBLIC_SUPPORT_URL`.
Add a custom domain (around $10/yr) once you're ready for ads.
Support link (Stripe)
Create a Stripe Payment Link with "Let customers choose what to pay". No code or backend is
needed. Paste the URL into `NEXT_PUBLIC_SUPPORT_URL` and the footer shows "☕ Support the project".
Leave the variable empty and the link is hidden. Call it "support" or "tip" rather than "donation",
because you are not a registered charity.
Cost and scaling
Stage	What to do	Approx. cost
Launch	Settings above	$0 (Cloud Run free tier is 180k vCPU-seconds/month, enough for roughly 10–15k uncached simulations)
Growing	Add a shared cache (Cloudflare KV or Upstash Redis) so all instances and restarts reuse results	$0–5/mo
Popular	Precompute a grid of scenarios offline and serve lookups and interpolation from a Cloudflare Worker. Only unusual inputs hit PyBaMM	~$5/mo
ML step	Train a small neural-network surrogate on thousands of PyBaMM runs. It answers in milliseconds and runs in the browser or a Worker	~$0
The input rounding in `EstimateRequest.cache_key()` (5 km, 5 % steps) is what keeps the cache hit
rate high.
Roadmap
[ ] Calibrate against real fleet data (see above)
[ ] LFP chemistry, which needs a parameter set with degradation data
[ ] Particle cracking / loss of active material (`particle mechanics` options; about 50 % slower)
[ ] Shared cache and a precomputed scenario grid
[ ] Neural-network surrogate model
[ ] Used-EV mode: enter the car's age and km to estimate its current SoH
[ ] Paid detailed PDF report, AdSense on the About and blog pages
Credits
PyBaMM: Sulzer et al., Journal of Open Research Software (2021)
OKane2022 parameters: O'Kane et al., PCCP (2022)
Inspired by Teixeira & da Silva, "Simulating Electric-Vehicle Battery Degradation with Physics
Based Battery Model"