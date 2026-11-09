from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_presets():
    data = client.get("/api/presets").json()
    assert "midsize_car" in data["vehicles"]
    assert "red_deer" in data["climates"]


def test_rejects_bad_input():
    r = client.post("/api/estimate", json={"vehicle": "spaceship"})
    assert r.status_code == 422
    r = client.post("/api/estimate", json={"climate": "custom", "custom_monthly_c": [10, 20]})
    assert r.status_code == 422


def test_estimate_and_cache():
    body = {"vehicle": "compact_car", "climate": "vancouver", "daily_km": 30, "years": 8}
    r1 = client.post("/api/estimate", json=body)
    assert r1.status_code == 200, r1.text
    d = r1.json()
    assert d["curve"][0]["soh_pct"] == 100.0
    assert d["curve"][-1]["year"] == 8
    sohs = [p["soh_pct"] for p in d["curve"]]
    assert sohs == sorted(sohs, reverse=True)  # health only goes down
    assert 50 < d["soh_at_end_pct"] < 100
    assert d["cached"] is False

    # 32 km rounds to the same 5 km bucket as 30 km -> served from cache
    r2 = client.post("/api/estimate", json={**body, "daily_km": 32})
    assert r2.json()["cached"] is True


def test_hot_climate_degrades_faster():
    base = {"vehicle": "midsize_car", "daily_km": 40, "years": 10}
    cold = client.post("/api/estimate", json={**base, "climate": "edmonton"}).json()
    hot = client.post("/api/estimate", json={**base, "climate": "phoenix"}).json()
    assert hot["soh_at_end_pct"] < cold["soh_at_end_pct"]