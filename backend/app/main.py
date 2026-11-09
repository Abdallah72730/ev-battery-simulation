import threading
import time
from collections import OrderedDict, defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .presets import CLIMATES, VEHICLES
from .schemas import EstimateRequest, EstimateResponse
from .simulation import estimate

app = FastAPI(title="Battery Health Estimator API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---- small in-memory LRU cache (per instance) ------------------------------
_cache: "OrderedDict[tuple, EstimateResponse]" = OrderedDict()
_cache_lock = threading.Lock()


def cache_get(key):
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    return None


def cache_put(key, value):
    with _cache_lock:
        _cache[key] = value
        _cache.move_to_end(key)
        while len(_cache) > config.CACHE_SIZE:
            _cache.popitem(last=False)


# ---- per-IP rate limit on expensive (uncached) simulations -----------------
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def allow(ip: str) -> bool:
    now = time.time()
    with _hits_lock:
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= config.RATE_LIMIT_PER_MINUTE:
            return False
        q.append(now)
        return True


def client_ip(request: Request) -> str:
    # Cloud Run / Cloudflare put the real client IP in X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


# ---- routes -----------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/presets")
def presets():
    return {
        "vehicles": {k: v["label"] for k, v in VEHICLES.items()},
        "climates": {k: v["label"] for k, v in CLIMATES.items()},
    }


@app.post("/api/estimate", response_model=EstimateResponse)
def run_estimate(req: EstimateRequest, request: Request):
    key = req.cache_key() + (req.years,)
    hit = cache_get(key)
    if hit:
        return hit.model_copy(update={"cached": True})

    if not allow(client_ip(request)):
        raise HTTPException(429, "Too many new simulations, please wait a minute.")
    try:
        result = estimate(req)
    except Exception as exc:  # solver failures etc.
        raise HTTPException(422, f"Simulation failed for these inputs: {exc}") from exc
    cache_put(key, result)
    return result