"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RatingPoint {
  date: string;
  rating: number;
  platform: string;
  time_class: string;
}

interface Props {
  data: RatingPoint[];
}

const TIME_CLASS_COLORS: Record<string, string> = {
  rapid: "#a78368",
  classical: "#b69a81",
  blitz: "#c2ad95",
  bullet: "#9a735c",
  daily: "#805e4e",
};

const PLATFORM_LABELS: Record<string, string> = {
  chesscom: "Chess.com",
  lichess: "Lichess",
};

export default function RatingChart({ data }: Props) {
  const platforms = useMemo(() => {
    return [...new Set(data.map((d) => d.platform))].sort();
  }, [data]);

  const [selectedPlatform, setSelectedPlatform] = useState<string>(() => {
    return platforms.includes("chesscom") ? "chesscom" : platforms[0] || "";
  });

  const timeClasses = useMemo(() => {
    return [...new Set(
      data.filter((d) => d.platform === selectedPlatform).map((d) => d.time_class)
    )].sort();
  }, [data, selectedPlatform]);

  const [selectedTimeClass, setSelectedTimeClass] = useState<string>(() => {
    const classes = [...new Set(
      data.filter((d) => d.platform === (platforms.includes("chesscom") ? "chesscom" : platforms[0] || "")).map((d) => d.time_class)
    )];
    return classes.includes("rapid") ? "rapid" : classes[0] || "";
  });

  // Reset time class when platform changes if current selection isn't available
  const activeTimeClass = timeClasses.includes(selectedTimeClass)
    ? selectedTimeClass
    : timeClasses.includes("rapid") ? "rapid" : timeClasses[0] || "";

  const chartData = useMemo(() => {
    return data
      .filter((d) => d.platform === selectedPlatform && d.time_class === activeTimeClass)
      .map((d) => ({
        ...d,
        date: new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
      }));
  }, [data, selectedPlatform, activeTimeClass]);

  const color = TIME_CLASS_COLORS[activeTimeClass] || "#a78368";

  return (
    <div>
      {/* Platform filter */}
      {platforms.length > 1 && (
        <div className="flex gap-2 mb-3">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => {
                setSelectedPlatform(p);
                // Auto-select rapid for new platform, or first available
                const classes = [...new Set(
                  data.filter((d) => d.platform === p).map((d) => d.time_class)
                )];
                setSelectedTimeClass(classes.includes("rapid") ? "rapid" : classes[0] || "");
              }}
              className={`px-3 py-1 rounded-lg text-sm font-medium btn-press ${
                selectedPlatform === p
                  ? "bg-accent-600 text-white"
                  : "bg-gray-700/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
              }`}
            >
              {PLATFORM_LABELS[p] || p}
            </button>
          ))}
        </div>
      )}

      {/* Time class filter */}
      <div className="flex gap-2 mb-4">
        {timeClasses.map((tc) => (
          <button
            key={tc}
            onClick={() => setSelectedTimeClass(tc)}
            className={`px-3 py-1 rounded-lg text-sm font-medium capitalize btn-press ${
              activeTimeClass === tc
                ? "bg-accent-600 text-white"
                : "bg-gray-700/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            {tc}
          </button>
        ))}
      </div>

      <div className="w-full" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={256} minWidth={0}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
            <XAxis
              dataKey="date"
              stroke="#90a2b1"
              fontSize={11}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 8))}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke="#90a2b1"
              fontSize={12}
              tickLine={false}
              domain={["dataMin - 50", "dataMax + 50"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#101c27",
                border: "1px solid #33495a",
                borderRadius: "8px",
                color: "#eaf0f3",
              }}
              labelFormatter={(label) => label}
              formatter={(value) => [`${value ?? ""}`, "Rating"]}
            />
            <Line
              type="monotone"
              dataKey="rating"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
