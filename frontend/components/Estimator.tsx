"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { fetchPresets, runEstimate, type EstimateRequest, type EstimateResponse } from "@/lib/api";

const SohChart = dynamic(() => import("./SohChart"), { ssr: false });
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Short names that read naturally inside the sentence.
const VEHICLE_WORDS: Record<string, string> = {
  compact_car: "a compact EV",
  midsize_car: "a mid-size EV",
  pickup: "an electric pickup",
  city_bus: "an electric city bus",
};
const CLIMATE_WORDS: Record<string, string> = {
  red_deer: "Red Deer",
  calgary: "Calgary",
  edmonton: "Edmonton",
  vancouver: "Vancouver",
  toronto: "Toronto",
  phoenix: "Phoenix",
};
const CHARGE_TO = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const FAST_SHARE = [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1];
const YEARS = [5, 8, 10, 12, 15, 20];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Estimator() {
  const [vehicles, setVehicles] = useState(VEHICLE_WORDS);
  const [climates, setClimates] = useState(CLIMATE_WORDS);
  const [form, setForm] = useState<EstimateRequest>({
    vehicle: "midsize_car",
    climate: "red_deer",
    daily_km: 40,
    fast_charge_share: 0.1,
    charge_target_soc: 0.8,
    thermal_management: true,
    years: 10,
  });
  const [temps, setTemps] = useState<number[]>([-5, -3, 2, 8, 13, 18, 21, 20, 15, 9, 2, -3]);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  // Loading presets also wakes the backend, hiding most of the cold-start delay.
  // Any vehicle or climate the backend adds later still shows up, using its full label.
  useEffect(() => {
    fetchPresets()
      .then((p) => {
        setVehicles({ ...Object.fromEntries(Object.entries(p.vehicles).map(([k, v]) => [k, `a ${v}`])), ...VEHICLE_WORDS });
        setClimates({ ...p.climates, ...CLIMATE_WORDS });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [result]);

  const set = <K extends keyof EstimateRequest>(k: K, v: EstimateRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = form.climate === "custom" ? { ...form, custom_monthly_c: temps } : form;
      setResult(await runEstimate(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The estimate didn't run. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} aria-describedby="form-status">
        <p className="sentence">
          I drive{" "}
          <Pick label="Vehicle" value={form.vehicle} options={Object.entries(vehicles)}
            onChange={(v) => set("vehicle", v)} />{" "}
          about{" "}
          <input className="field field-km" aria-label="Kilometres per day" type="number" inputMode="numeric"
            min={1} max={600} required value={form.daily_km}
            onChange={(e) => set("daily_km", Number(e.target.value))} />{" "}
          km a day in{" "}
          <span className="nowrap">
            <Pick label="Climate" value={form.climate}
              options={[...Object.entries(climates), ["custom", "somewhere else"]]}
              onChange={(v) => set("climate", v)} />.
          </span>{" "}
          I charge to{" "}
          <span className="nowrap">
            <Pick label="Charge target" value={form.charge_target_soc}
              options={CHARGE_TO.map((v) => [v, pct(v)])}
              onChange={(v) => set("charge_target_soc", Number(v))} />,
          </span>{" "}
          use fast chargers for{" "}
          <Pick label="Share of fast charging" value={form.fast_charge_share}
            options={FAST_SHARE.map((v) => [v, pct(v)])}
            onChange={(v) => set("fast_charge_share", Number(v))} />{" "}
          of charges, and the battery{" "}
          <Pick label="Thermal management" value={form.thermal_management ? "yes" : "no"}
            options={[["yes", "is"], ["no", "isn\u2019t"]]}
            onChange={(v) => set("thermal_management", v === "yes")} />{" "}
          heated and cooled. Show me the next{" "}
          <span className="nowrap">
            <Pick label="Years to project" value={form.years}
              options={YEARS.map((v) => [v, `${v} years`])}
              onChange={(v) => set("years", Number(v))} />.
          </span>
        </p>

        {form.climate === "custom" && (
          <fieldset className="temps">
            <legend>Average temperature each month, in °C</legend>
            {MONTHS.map((m, i) => (
              <label key={m}>
                {m}
                <input type="number" step="0.5" min={-45} max={50} value={temps[i]}
                  onChange={(e) => {
                    const next = [...temps];
                    next[i] = Number(e.target.value);
                    setTemps(next);
                  }} />
              </label>
            ))}
          </fieldset>
        )}

        <div className="actions">
          <button className="run" type="submit" disabled={loading}>
            {loading ? "Running the model…" : "Estimate battery health"}
          </button>
          <p id="form-status" className={error ? "status error" : "status"} role="status">
            {error ?? (loading ? "Simulating a year of driving, parking and charging. This takes a few seconds." : "")}
          </p>
        </div>
      </form>

      {result && (
        <section className="result" ref={resultRef} aria-label="Estimate">
          <Answer result={result} years={form.years} />
          <SohChart data={result.curve} />
          <p className="chart-caption">
            Share of the original capacity left each year. The shaded band is where packs are usually
            retired from driving and reused for stationary storage.
          </p>

          <div className="details">
            <div>
              <h2>What wears the battery</h2>
              <ul className="wear">
                {Object.entries(result.fade_breakdown_pct).map(([k, v]) => (
                  <li key={k}>
                    <span>{k === "SEI growth" ? "Surface film growth (SEI)" : k}</span>
                    <span className="pct">{v}%</span>
                    <span className="meter" aria-hidden="true"><span style={{ width: `${v}%` }} /></span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>What happens after</h2>
              <p>{result.second_life}</p>
            </div>
          </div>

          <div className="fineprint">
            <p>
              Each day uses {result.daily_depth_of_discharge_pct}% of the battery.{" "}
              {result.cached ? "This result was loaded from an earlier run." : `The model took ${result.sim_seconds} seconds.`}{" "}
              Real packs vary with chemistry, manufacturer software and how the car was treated.
            </p>
            {SUPPORT_URL && (
              <p>
                The simulations run on a real server. If this helped,{" "}
                <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">you can support the project</a>.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

// A <select> that is only as wide as its chosen option, so it sits inside the sentence like a word.
function Pick({ value, options, label, onChange }: {
  value: string | number;
  options: [string | number, string][];
  label: string;
  onChange: (v: string) => void;
}) {
  const measure = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();
  const text = options.find(([k]) => String(k) === String(value))?.[1] ?? "";
  useLayoutEffect(() => {
    // Measure again once the web font has loaded; the fallback font is narrower.
    const fit = () => measure.current && setWidth(measure.current.getBoundingClientRect().width + 10);
    fit();
    document.fonts?.ready.then(fit);
  }, [text]);
  return (
    <>
      <span ref={measure} className="field measure" aria-hidden="true">{text}</span>
      <select className="field" aria-label={label} value={value} style={{ width }}
        onChange={(e) => onChange(e.target.value)}>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </>
  );
}

function Answer({ result, years }: { result: EstimateResponse; years: number }) {
  const end = result.curve[result.curve.length - 1];
  const y80 = result.years_to_80_pct;
  const y70 = result.years_to_70_pct;

  let milestones: string;
  if (y80 === null) milestones = "In this model it stays above 80% for more than 40 years.";
  else if (y70 === null) milestones = `It reaches 80% after about ${y80} years and stays above 70% for more than 40.`;
  else milestones = `It reaches 80% after about ${y80} years and 70% after about ${y70}.`;

  return (
    <>
      <p className="answer">
        After {years} years the battery should hold about <strong>{result.soh_at_end_pct}%</strong> of its
        original capacity, roughly <strong>{Math.round(end.range_km)} km</strong> of range compared with{" "}
        {Math.round(result.new_range_km)} km when new.
      </p>
      <p className="answer-sub">{milestones}</p>
    </>
  );
}
