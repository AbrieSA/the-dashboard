export function formatMetricValue(value: number | null, unit: string) {
  if (value === null || Number.isNaN(value)) {
    return "No data";
  }

  switch (unit) {
    case "percentage":
      return `${(value * 100).toFixed(1)}%`;
    case "milliseconds":
      return `${Math.round(value).toLocaleString()} ms`;
    case "count":
      return Math.round(value).toLocaleString();
    case "rank":
      return `#${Math.round(value).toLocaleString()}`;
    default:
      return value.toFixed(2);
  }
}

export function formatDelta(delta: number | null, unit: string) {
  if (delta === null || Number.isNaN(delta)) {
    return "No prior period";
  }

  const prefix = delta > 0 ? "+" : "";
  if (unit === "percentage") {
    return `${prefix}${(delta * 100).toFixed(1)} pts`;
  }

  return `${prefix}${delta.toFixed(1)}`;
}
