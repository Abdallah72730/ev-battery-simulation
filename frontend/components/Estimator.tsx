"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  FALLBACK_PRESETS,
  fetchPresets,
  runEstimate,
  type EstimateRequest,
  type EstimateResponse,
} from "@/lib/api";

const SohChart = dynamic(() => import("./SohChart"), { ssr: false });
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Estimator() {
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [form, setForm] = useState<EstimateRequest>({
    vehicle: "midsize_car",
    climate: "red_deer",
    daily_km: 40,
    fast_charge_share: 0.1,
    charge_target_soc: 0.8,
    thermal_management: true,
    years: 10,
  });
  const [customTemps, setCustomTemps] = useState<number[]>(Array(12).fill(10));
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetching presets also wakes the backend up, hiding most of the cold-start delay.
  useEffect(() => {
    fetchPresets().then(setPresets).catch(() => {});
  }, []);

  const set = <K extends keyof EstimateRequest>(k: K, v: EstimateRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = form.climate === "custom" ? { ...form, custom_monthly_c: customTemps } : form;
      setResult(await runEstimate(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid">
      <form className="card" onSubmit={submit}>
        <h2>Your vehicle and driving</h2>

        <label>
          Vehicle
          <select value={form.vehicle} onChange={(e) => set("vehicle", e.target.value)}>
            {Object.entries(presets.vehicles).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>

        <label>
          Climate
          <select value={form.climate} onChange={(e) => set("climate", e.target.value)}>
            {Object.entries(presets.climates).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
            <option value="custom">Custom (enter monthly temperatures)</option>
          </select>
        </label>

        {form.climate === "custom" && (
          <fieldset className="temps">
            <legend>Average monthly temperature (°C)</legend>
            {MONTHS.map((m, i) => (
              <label key={m} className="temp">
                {m}
                <input
                  type="number"
                  step="0.1"
                  value={customTemps[i]}
                  onChange={(e) => {
                    const next = [...customTemps];
                    next[i] = Number(e.target.value);
                    setCustomTemps(next);
                  }}
                />
              </label>
            ))}
          </fieldset>
        )}

        <label>
          Daily driving: <strong>{form.daily_km} km</strong>
          <input type="range" min={5} max={400} step={5} value={form.daily_km}
            onChange={(e) => set("daily_km", Number(e.target.value))} />
        </label>

        <label>
          DC fast charging: <strong>{Math.round(form.fast_charge_share * 100)}%</strong> of charges
          <input type="range" min={0} max={1} step={0.05} value={form.fast_charge_share}
            onChange={(e) => set("fast_charge_share", Number(e.target.value))} />
        </label>

        <label>
          Charge to: <strong>{Math.round(form.charge_target_soc * 100)}%</strong>
          <input type="range" min={0.5} max={1} step={0.05} value={form.charge_target_soc}
            onChange={(e) => set("charge_target_soc", Number(e.target.value))} />
        </label>

        <label>
          Years to project: <strong>{form.years}</strong>
          <input type="range" min={1} max={20} step={1} value={form.years}
            onChange={(e) => set("years", Number(e.target.value))} />
        </label>

        <label className="check">
          <input type="checkbox" checked={form.thermal_management}
            onChange={(e) => set("thermal_management", e.target.checked)} />
          Battery has active thermal management (heating/cooling)
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Simulating a year of driving…" : "Estimate battery health"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <section className="card results" aria-live="polite">
        {!result && !loading && (
          <p className="muted">
            Pick your vehicle, climate and habits, then run the estimate. The physics model simulates
            365 days of driving, parking and charging, then projects the battery&apos;s health forward.
          </p>
        )}
        {loading && <p className="muted">Running the electrochemical model — this takes a few seconds.</p>}
        {result && !loading && (
          <>
            <h2>Estimated battery health</h2>
            <div className="stats">
              <Stat label={`After ${form.years} years`} value={`${result.soh_at_end_pct}%`} />
              <Stat label="Range then" value={`${Math.round(result.curve.at(-1)!.range_km)} km`}
                sub={`new: ${Math.round(result.new_range_km)} km`} />
              <Stat label="Reaches 80%" value={result.years_to_80_pct ? `${result.years_to_80_pct} yrs` : "40+ yrs"} />
              <Stat label="Reaches 70%" value={result.years_to_70_pct ? `${result.years_to_70_pct} yrs` : "40+ yrs"} />
            </div>
            <SohChart data={result.curve} />
            <p className="advice">{result.second_life}</p>
            <h3>What&apos;s causing the wear (year 1)</h3>
            <ul className="breakdown">
              {Object.entries(result.fade_breakdown_pct).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <span className="bar"><span style={{ width: `${v}%` }} /></span>
                  <span>{v}%</span>
                </li>
              ))}
            </ul>
            <p className="fine">
              Daily depth of discharge {result.daily_depth_of_discharge_pct}% · {result.climate_label} ·{" "}
              {result.cached ? "cached result" : `simulated in ${result.sim_seconds}s`}. Estimates only — real
              packs vary with chemistry, manufacturer software and how the car was treated.
            </p>
            {SUPPORT_URL && (
              <p className="support">
                Found this useful? The simulations run on a real server —{" "}
                <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">☕ support the project</a>.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}