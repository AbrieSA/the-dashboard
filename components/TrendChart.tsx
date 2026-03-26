"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

export type TrendPoint = {
  label: string;
  value: number;
};

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No trend data yet.</div>;
  }

  return (
    <div style={{ width: "100%", height: 84 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#244c5a" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#244c5a" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <Tooltip
            formatter={(value) => (typeof value === "number" ? value.toFixed(2) : String(value ?? ""))}
            labelStyle={{ color: "#1f2933" }}
          />
          <Area type="monotone" dataKey="value" stroke="#244c5a" strokeWidth={2} fill="url(#spark)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
