"""Physics-based battery degradation estimate.

How it works
------------
1. Turn the user's driving profile into one "representative day":
   drive (discharge) -> park (rest) -> charge, using C-rates so the result
   is independent of pack size.
2. Simulate 365 of those days with PyBaMM's Single Particle Model (SPM) plus
   SEI growth and lithium plating, with the ambient temperature changing month
   by month for the chosen climate. Parameters: OKane2022 (LG M50, NMC811 /
   graphite-SiOx), which ship with degradation parameters.
3. Fit loss-of-lithium-inventory (LLI) over that first year with
   LLI(t) = a*sqrt(t) + b*t + c  (sqrt term ~ SEI growth, linear term ~ plating
   and other per-cycle damage) and extrapolate to later years.
4. Scale by CALIBRATION_FACTOR to account for mechanisms this model leaves out
   (loss of active material, cracking), then convert to state of health.
"""

from __future__ import annotations

import logging
import time
from functools import lru_cache

import numpy as np
import pybamm
from scipy.optimize import nnls

from .config import CALIBRATION_FACTOR
from .presets import CLIMATES, DAYS_IN_MONTH, VEHICLES
from .schemas import EstimateRequest, EstimateResponse, YearPoint

pybamm.set_logging_level("ERROR")
logging.getLogger("pybamm").setLevel(logging.ERROR)

MODEL_NAME = "PyBaMM SPM + SEI (solvent-diffusion) + partially reversible Li plating, OKane2022 parameters"
MIN_SOC = 0.10
MAX_C_RATE = 2.0


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _start_soc(req: EstimateRequest) -> float:
    # Real packs keep a top buffer, so "100 %" on the dash is ~95 % of the cell's window.
    return min(req.charge_target_soc, 0.95)


def build_day_profile(req: EstimateRequest) -> dict:
    v = VEHICLES[req.vehicle]
    energy_kwh = req.daily_km * v["kwh_per_km"]
    dod = energy_kwh / v["pack_kwh"]
    dod = _clamp(dod, 0.01, req.charge_target_soc - MIN_SOC)

    drive_h = _clamp(req.daily_km / v["avg_speed_kmh"], 0.1, 16.0)
    slow_c = _clamp(v["level2_kw"] / v["pack_kwh"], 0.05, MAX_C_RATE)
    fast_c = _clamp(v["dcfc_kw"] / v["pack_kwh"], slow_c, MAX_C_RATE)
    return {
        "dod": dod,
        "drive_h": drive_h,
        "discharge_c": dod / drive_h,
        "slow_c": slow_c,
        "fast_c": fast_c,
        "range_km": v["pack_kwh"] / v["kwh_per_km"],
    }


@lru_cache(maxsize=32)
def target_voltage(soc: float) -> float:
    """Open-circuit voltage at a given state of charge, used as the charger's stop voltage.

    Charging "until this voltage" (instead of putting back exactly the Ah used) mimics a real
    charger and stops the state of charge drifting downward over the simulated year.
    """
    sim = pybamm.Simulation(
        pybamm.lithium_ion.SPM(),
        parameter_values=pybamm.ParameterValues("OKane2022"),
        experiment=pybamm.Experiment(["Rest for 1 minute"]),
    )
    sol = sim.solve(initial_soc=soc)
    return float(sol["Voltage [V]"].entries[0])


def _monthly_temps(req: EstimateRequest) -> list[float]:
    if req.climate == "custom":
        return list(req.custom_monthly_c)
    return CLIMATES[req.climate]["monthly_c"]


def build_experiment(req: EstimateRequest, prof: dict) -> pybamm.Experiment:
    S = pybamm.step.string
    temps = _monthly_temps(req)
    every = round(1 / req.fast_charge_share) if req.fast_charge_share > 0 else 0
    v_stop = target_voltage(_start_soc(req))

    cycles = []
    day = 0
    for month, ambient in enumerate(temps):
        # With thermal management the pack is heated/cooled while driving or charging.
        active = _clamp(ambient, 15, 30) if req.thermal_management else ambient
        for _ in range(DAYS_IN_MONTH[month]):
            day += 1
            fast = every > 0 and day % every == 0
            c_rate = prof["fast_c"] if fast else prof["slow_c"]
            # Allow 50 % extra time; the voltage limit normally ends the charge first.
            charge_h = 1.5 * prof["dod"] / c_rate
            rest_h = max(24 - prof["drive_h"] - charge_h, 0.1)
            cycles.append((
                S(f"Discharge at {prof['discharge_c']:.5f}C for {prof['drive_h'] * 60:.2f} minutes or until 2.6V",
                  temperature=f"{active:.1f}oC"),
                S(f"Rest for {rest_h * 60:.2f} minutes", temperature=f"{ambient:.1f}oC"),
                S(f"Charge at {c_rate:.5f}C for {charge_h * 60:.2f} minutes or until {v_stop:.4f}V",
                  temperature=f"{active:.1f}oC"),
            ))
    return pybamm.Experiment(cycles)


def simulate_first_year(req: EstimateRequest, prof: dict) -> dict:
    model = pybamm.lithium_ion.SPM({
        "SEI": "solvent-diffusion limited",
        "lithium plating": "partially reversible",
    })
    params = pybamm.ParameterValues("OKane2022")
    sim = pybamm.Simulation(model, parameter_values=params, experiment=build_experiment(req, prof))
    sol = sim.solve(initial_soc=_start_soc(req))

    sv = sol.summary_variables
    lli = np.asarray(sv["Loss of lithium inventory [%]"], dtype=float)
    sei_ah = np.asarray(sv["Loss of capacity to negative SEI [A.h]"], dtype=float)
    plating_ah = np.asarray(sv["Loss of capacity to negative lithium plating [A.h]"], dtype=float)
    if len(lli) < 60:
        raise RuntimeError(f"simulation stopped early after {len(lli)} days")
    return {"lli_pct": lli, "sei_ah": sei_ah[-1], "plating_ah": plating_ah[-1]}


def fit_and_extrapolate(lli_pct: np.ndarray):
    """Fit LLI(t)=a*sqrt(t)+b*t+c on days 30..end, return a predictor in years."""
    days = np.arange(1, len(lli_pct) + 1, dtype=float)
    mask = days >= 30
    A = np.column_stack([np.sqrt(days[mask]), days[mask], np.ones(mask.sum())])
    coef, _ = nnls(A, lli_pct[mask])
    a, b, c = coef

    def predict(years):
        d = np.asarray(years, dtype=float) * 365.0
        return np.where(d <= 0, 0.0, a * np.sqrt(d) + b * d + c)

    return predict


def _years_to(predict_soh, threshold: float, horizon: float = 40.0):
    grid = np.linspace(0, horizon, 4001)
    soh = predict_soh(grid)
    below = np.nonzero(soh <= threshold)[0]
    return round(float(grid[below[0]]), 1) if len(below) else None


def second_life_advice(soh_end: float, years: int) -> str:
    if soh_end >= 80:
        return (f"Still above 80% after {years} years: suitable for continued driving. "
                "Packs usually move to stationary storage once they fall to roughly 70–80%.")
    if soh_end >= 70:
        return ("In the typical repurposing window (70–80% SoH). A good candidate for "
                "second-life grid or home energy storage, where lower energy density matters less.")
    return ("Below ~70% SoH: limited range for driving and reduced value for second-life storage; "
            "recycling for materials may be the better route.")


def estimate(req: EstimateRequest) -> EstimateResponse:
    t0 = time.perf_counter()
    prof = build_day_profile(req)
    year1 = simulate_first_year(req, prof)
    predict_lli = fit_and_extrapolate(year1["lli_pct"])

    def predict_soh(years):
        return np.clip(100.0 - CALIBRATION_FACTOR * predict_lli(years), 0, 100)

    steps = np.arange(0, req.years + 0.001, 0.5)
    soh = predict_soh(steps)
    curve = [
        YearPoint(year=float(y), soh_pct=round(float(s), 2), range_km=round(prof["range_km"] * s / 100, 1))
        for y, s in zip(steps, soh)
    ]

    total = year1["sei_ah"] + year1["plating_ah"]
    breakdown = (
        {"SEI growth": round(100 * year1["sei_ah"] / total, 1),
         "Lithium plating": round(100 * year1["plating_ah"] / total, 1)}
        if total > 0 else {"SEI growth": 100.0, "Lithium plating": 0.0}
    )
    soh_end = float(soh[-1])

    return EstimateResponse(
        vehicle_label=VEHICLES[req.vehicle]["label"],
        climate_label="Custom climate" if req.climate == "custom" else CLIMATES[req.climate]["label"],
        new_range_km=round(prof["range_km"], 1),
        daily_depth_of_discharge_pct=round(prof["dod"] * 100, 1),
        curve=curve,
        soh_at_end_pct=round(soh_end, 1),
        years_to_80_pct=_years_to(predict_soh, 80),
        years_to_70_pct=_years_to(predict_soh, 70),
        second_life=second_life_advice(soh_end, req.years),
        fade_breakdown_pct=breakdown,
        model=MODEL_NAME,
        sim_seconds=round(time.perf_counter() - t0, 2),
    )