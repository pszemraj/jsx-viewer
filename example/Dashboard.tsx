import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, TrendingDown, TrendingUp, Zap } from "lucide-react";

type Range = "24h" | "7d" | "30d" | "90d";

interface DataPoint {
  month: string;
  value: number;
  prev: number;
}

interface StatCardProps {
  icon: typeof Activity;
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

const data: DataPoint[] = [
  { month: "Jan", value: 2400, prev: 1800 },
  { month: "Feb", value: 1398, prev: 2200 },
  { month: "Mar", value: 4800, prev: 3200 },
  { month: "Apr", value: 3908, prev: 3600 },
  { month: "May", value: 4800, prev: 4100 },
  { month: "Jun", value: 3800, prev: 3900 },
  { month: "Jul", value: 5300, prev: 4300 },
];

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  positive,
}: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-500 text-sm font-medium">{label}</span>
        <Icon className="w-4 h-4 text-zinc-600" />
      </div>
      <div className="text-2xl font-semibold text-zinc-100 mb-1">{value}</div>
      <div
        className={`text-xs font-medium flex items-center gap-1 ${
          positive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {positive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {change}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<Range>("7d");

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Performance
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              System metrics overview
            </p>
          </div>
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            {(["24h", "7d", "30d", "90d"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  range === value
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={Activity}
            label="Requests"
            value="48.2K"
            change="+12.5% vs prev"
            positive
          />
          <StatCard
            icon={Zap}
            label="Latency (p99)"
            value="142ms"
            change="-8.3% vs prev"
            positive
          />
          <StatCard
            icon={TrendingUp}
            label="Error Rate"
            value="0.03%"
            change="+0.01% vs prev"
            positive={false}
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">
            Request Volume
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="current" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="month"
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Area
                type="monotone"
                dataKey="prev"
                stroke="#3f3f46"
                fill="none"
                strokeDasharray="4 4"
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fill="url(#current)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
