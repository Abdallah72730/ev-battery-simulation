import os


def _list(name: str, default: str) -> list[str]:
    return [s.strip() for s in os.getenv(name, default).split(",") if s.strip()]


# Origins allowed to call the API (your Cloudflare Pages domain in production).
CORS_ORIGINS = _list("CORS_ORIGINS", "http://localhost:3000")

# The SPM+SEI model only captures lithium-inventory loss from SEI growth and
# plating. Real packs also lose active material (particle cracking, etc.), so the
# raw model under-predicts fade. This factor scales simulated loss to match
# field data. Tune it against a real dataset (see README "Calibration").
CALIBRATION_FACTOR = float(os.getenv("CALIBRATION_FACTOR", "1.8"))

# Simple per-IP rate limit for uncached simulations.
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "10"))

# How many distinct results to keep in memory.
CACHE_SIZE = int(os.getenv("CACHE_SIZE", "512"))