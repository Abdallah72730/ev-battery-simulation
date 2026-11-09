"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { YearPoint } from "@/lib/api";

const INK = "#17222e";
const MUTED = "#5c6873";
const RULE = "#cdd5d8";
const LITHIUM = "#b3123a";

const tick = {
  fill: MUTED,
  fontSize: 13,
  fontFamily: "var(--font)",
  style: { fontVariationSettings: '"wdth" 80' },
};

export default function SohChart({ data }: { data: YearPoint[] }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const minSoh = Math.min(...data.map((d) => d.soh_pct));
  const yMin = Math.max(0, Math.floor((Math.min(minSoh, 70) - 5) / 10) * 10);
  const maxYear = data[data.length - 1]?.year ?? 10;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={RULE} strokeWidth={1} vertical={false} />
          <ReferenceArea
            y1={70}
            y2={80}
            fill={LITHIUM}
            fillOpacity={0.06}
            stroke="none"
            label={{ value: "Second-life range", position: "insideTopRight", fill: MUTED, fontSize: 13 }}
          />
          <XAxis
            dataKey="year"
            type="number"
            domain={[0, maxYear]}
            ticks={Array.from({ length: maxYear + 1 }, (_, i) => i).filter((y) => maxYear <= 12 || y % 2 === 0)}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: INK }}
            label={{ value: "Years from today", position: "insideBottom", offset: -18, fill: MUTED, fontSize: 13 }}
          />
          <YAxis
            domain={[yMin, 100]}
            ticks={Array.from({ length: (100 - yMin) / 10 + 1 }, (_, i) => yMin + i * 10)}
            tickFormatter={(v) => `${v}%`}
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: RULE }}
            contentStyle={{
              background: "#ffffff",
              border: `1px solid ${RULE}`,
              borderRadius: 4,
              fontFamily: "var(--font)",
              fontSize: 14,
              color: INK,
            }}
            formatter={(v) => [`${Number(v).toFixed(1)}%`, "Capacity left"]}
            labelFormatter={(y) => `Year ${y}`}
            separator=": "
          />
          <Line
            type="monotone"
            dataKey="soh_pct"
            stroke={LITHIUM}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, fill: LITHIUM, stroke: "#ffffff", strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={900}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
