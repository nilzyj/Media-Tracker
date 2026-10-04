"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_STYLE = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
} as const;

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.6 0.12 200)",
  "oklch(0.55 0.14 130)",
  "oklch(0.5 0.16 20)",
];

export function CompletionsByYearChart({
  data,
}: {
  data: { year: number; count: number }[];
}) {
  if (data.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" name="看完数量" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GenrePieChart({ data }: { data: { name: string; count: number }[] }) {
  const top = data.slice(0, 8);
  if (top.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={top}
          dataKey="count"
          nameKey="name"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={2}
          stroke="var(--border)"
        >
          {top.map((_, index) => (
            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend
          verticalAlign="bottom"
          height={36}
          wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ScoreHistogram({
  data,
}: {
  data: { score: number; count: number }[];
}) {
  if (data.length === 0) return <ChartEmpty />;

  const filled = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    return { score: `${score} 分`, count: data.find((d) => d.score === score)?.count ?? 0 };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={filled} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="score" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" name="评分数" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusBarChart({
  workData,
  seasonData,
  labels,
}: {
  workData: number[];
  seasonData: number[];
  labels: string[];
}) {
  const data = labels.map((name, i) => ({
    name,
    作品: workData[i] ?? 0,
    季: seasonData[i] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          width={48}
        />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
        <Bar dataKey="作品" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
        <Bar dataKey="季" fill="var(--chart-5)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty() {
  return (
    <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
      暂无数据
    </div>
  );
}
