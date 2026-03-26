import { TargetType } from "@prisma/client";
import { targetRowSchema, type TargetRow } from "@/lib/validation";

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export async function fetchTargetRows(url: string): Promise<TargetRow[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/csv",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Google Sheet CSV: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((value) => value.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return targetRowSchema.parse({
      metricKey: record.metricKey,
      targetType: record.targetType as TargetType,
      targetValue: record.targetValue,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
      notes: record.notes,
    });
  });
}
