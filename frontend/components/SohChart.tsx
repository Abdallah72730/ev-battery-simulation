"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { YearPoint } from "@/lib/api";

export default function SohChart({ data }: { data: YearPoint[] }) {
  const minSoh = Math.min(...data.map((d) => d.soh_pct));
  const yMin = Math.max(0, Math.floor((Math.min(minSoh, 70) - 5) / 5) * 5);

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="year"
            type="number"
            domain={[0, "dataMax"]}
            tickCount={11}
            label={{ value: "Years", position: "insideBottom", offset: -10 }}
          />
          <YAxis
            domain={[yMin, 100]}
            ticks={Array.from({ length: (100 - yMin) / 5 + 1 }, (_, i) => yMin + i * 5)}
            unit="%"
            width={52}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(1)} %`, "State of health"]}
            labelFormatter={(y) => `Year ${y}`}
          />
          <ReferenceLine y={80} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: "80%", position: "right" }} />
          <ReferenceLine y={70} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: "70%", position: "right" }} />
          <Line type="monotone" dataKey="soh_pct" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}