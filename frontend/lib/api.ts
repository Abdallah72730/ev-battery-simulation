export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

export type EstimateRequest = {
  vehicle: string;
  climate: string;
  custom_monthly_c?: number[];
  daily_km: number;
  fast_charge_share: number;
  charge_target_soc: number;
  thermal_management: boolean;
  years: number;
};

export type YearPoint = { year: number; soh_pct: number; range_km: number };

export type EstimateResponse = {
  vehicle_label: string;
  climate_label: string;
  new_range_km: number;
  daily_depth_of_discharge_pct: number;
  curve: YearPoint[];
  soh_at_end_pct: number;
  years_to_80_pct: number | null;
  years_to_70_pct: number | null;
  second_life: string;
  fade_breakdown_pct: Record<string, number>;
  model: string;
  cached: boolean;
  sim_seconds: number;
};

// Fallback labels so the form renders instantly, even while the backend cold-starts.
export const FALLBACK_PRESETS = {
  vehicles: {
    compact_car: "Compact EV (e.g. 60 kWh hatchback)",
    midsize_car: "Mid-size EV sedan/SUV (e.g. 80 kWh)",
    pickup: "Electric pickup (e.g. 130 kWh)",
    city_bus: "Electric city bus (e.g. 450 kWh)",
  } as Record<string, string>,
  climates: {
    red_deer: "Red Deer, AB",
    calgary: "Calgary, AB",
    edmonton: "Edmonton, AB",
    vancouver: "Vancouver, BC",
    toronto: "Toronto, ON",
    phoenix: "Phoenix, AZ",
  } as Record<string, string>,
};

export async function fetchPresets() {
  const r = await fetch(`${API_URL}/api/presets`);
  if (!r.ok) throw new Error("presets failed");
  return (await r.json()) as typeof FALLBACK_PRESETS;
}

export async function runEstimate(body: EstimateRequest): Promise<EstimateResponse> {
  const r = await fetch(`${API_URL}/api/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : "Please check your inputs.";
    throw new Error(r.status === 429 ? "Too many simulations — try again in a minute." : detail);
  }
  return r.json();
}