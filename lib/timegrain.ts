export const dashboardTimegrains = ["WEEK", "MONTH", "YEAR"] as const;

export type DashboardTimegrain = (typeof dashboardTimegrains)[number];

export type TimeWindow = {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date) {
  const start = startOfUtcDay(date);
  const day = start.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + offset);
  return start;
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfUtcYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

export function startOfTimegrain(date: Date, timegrain: DashboardTimegrain) {
  if (timegrain === "WEEK") {
    return startOfUtcWeek(date);
  }

  if (timegrain === "YEAR") {
    return startOfUtcYear(date);
  }

  return startOfUtcMonth(date);
}

function shiftTimegrain(date: Date, timegrain: DashboardTimegrain, amount: number) {
  const shifted = new Date(date);

  if (timegrain === "WEEK") {
    shifted.setUTCDate(shifted.getUTCDate() + amount * 7);
    return shifted;
  }

  if (timegrain === "YEAR") {
    shifted.setUTCFullYear(shifted.getUTCFullYear() + amount);
    return shifted;
  }

  shifted.setUTCMonth(shifted.getUTCMonth() + amount);
  return shifted;
}

export function getTimeWindow(timegrain: DashboardTimegrain, asOf?: string) {
  const currentEnd = asOf ? new Date(asOf) : new Date();
  const currentStart = startOfTimegrain(currentEnd, timegrain);
  const previousStart = shiftTimegrain(currentStart, timegrain, -1);

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd: currentStart,
  } satisfies TimeWindow;
}

export function getBucketKey(date: Date, timegrain: DashboardTimegrain) {
  if (timegrain === "YEAR") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getBucketLabel(date: Date, timegrain: DashboardTimegrain) {
  if (timegrain === "WEEK") {
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      timeZone: "UTC",
    });
  }

  if (timegrain === "YEAR") {
    return date.toLocaleDateString("en-AU", {
      month: "short",
      timeZone: "UTC",
    });
  }

  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
