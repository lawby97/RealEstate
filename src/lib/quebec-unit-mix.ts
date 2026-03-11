export interface ParsedBedroomMix {
  source: "parsed_unit_mix";
  unitCount: number;
  sampleUnitCount: number;
  isComplete: boolean;
  totalBedrooms: number;
  avgBedroomsPerUnit: number;
  basisBedrooms: number;
  bedroomsPerUnit: number[];
  roomCounts: number[];
  label: string;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  un: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six_fr: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
};

function toCount(value: string | undefined): number {
  if (!value) return 1;
  const clean = value.trim().toLowerCase();
  if (/^\d+$/.test(clean)) return Number(clean);
  if (clean === "six") return 6;
  return NUMBER_WORDS[clean] ?? 1;
}

function roomCountToBedrooms(roomCount: number): number | null {
  if (!Number.isFinite(roomCount)) return null;
  // Quebec shorthand: 3.5 -> 1 bed, 4.5 -> 2 bed, 5.5 -> 3 bed, etc.
  const bedrooms = Math.round(roomCount - 2.5);
  if (bedrooms < 0) return null;
  return bedrooms;
}

function collapseRepeatedPattern(values: number[], expectedUnits: number): number[] {
  if (expectedUnits <= 1 || values.length <= expectedUnits || values.length % expectedUnits !== 0) {
    return values;
  }

  const basePattern = values.slice(0, expectedUnits);
  for (let offset = expectedUnits; offset < values.length; offset += expectedUnits) {
    for (let index = 0; index < expectedUnits; index += 1) {
      if (values[offset + index] !== basePattern[index]) {
        return values;
      }
    }
  }

  return basePattern;
}

function normalizeMixText(text: string): string {
  return text
    .toLowerCase()
    .replace(/½/g, ".5")
    .replace(/(\d+)\s*1\/2/g, "$1.5")
    .replace(/(\d)\s*,\s*5/g, "$1.5")
    .replace(/\s+/g, " ");
}

function parseRoomFormatMix(normalized: string): { roomCounts: number[]; unitCount: number } {
  const pattern = /(?:(\b\d+\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\beleven\b|\btwelve\b|\bun\b|\bdeux\b|\btrois\b|\bquatre\b|\bcinq\b|\bsept\b|\bhuit\b|\bneuf\b|\bdix\b|\bonze\b|\bdouze\b)\s*(?:x|×)?\s*)?(\d+(?:\.\d+)?)\s*(?:units?|unites?|apartments?|appartements?|logements?)/g;
  const compactPattern = /(\b\d+\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\beleven\b|\btwelve\b|\bun\b|\bdeux\b|\btrois\b|\bquatre\b|\bcinq\b|\bsept\b|\bhuit\b|\bneuf\b|\bdix\b|\bonze\b|\bdouze\b)\s*(?:x|×)\s*(\d+(?:\.\d+)?)(?=\s*(?:[\),.;]|$))/g;
  const roomCounts: number[] = [];
  let unitCount = 0;
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(normalized)) !== null) {
    const count = toCount(match[1]);
    const roomValue = Number(match[2]);
    if (!Number.isFinite(roomValue)) continue;
    for (let i = 0; i < Math.max(1, count); i += 1) roomCounts.push(roomValue);
    unitCount += Math.max(1, count);
  }
  while ((match = compactPattern.exec(normalized)) !== null) {
    const count = toCount(match[1]);
    const roomValue = Number(match[2]);
    if (!Number.isFinite(roomValue)) continue;
    for (let i = 0; i < Math.max(1, count); i += 1) roomCounts.push(roomValue);
    unitCount += Math.max(1, count);
  }
  return { roomCounts, unitCount };
}

function parseBedroomMixTokens(normalized: string): { bedroomsPerUnit: number[]; unitCount: number } {
  const bedroomsPerUnit: number[] = [];
  let unitCount = 0;
  // Handles: "2x1br, 3x2 bedroom units, 1 x 3 bed apt"
  const compactPattern = /(\d+)\s*(?:x|×)\s*(\d+)\s*(?:bed|beds|bedroom|bedrooms|br|bdrm)\b/g;
  let match: RegExpExecArray | null = null;
  while ((match = compactPattern.exec(normalized)) !== null) {
    const count = Number(match[1]);
    const bedrooms = Number(match[2]);
    if (!Number.isFinite(count) || !Number.isFinite(bedrooms) || count <= 0 || bedrooms < 0) continue;
    for (let i = 0; i < count; i += 1) bedroomsPerUnit.push(bedrooms);
    unitCount += count;
  }

  // Handles: "three 2-bedroom units", "4 one-bedroom apartments"
  const phrasePattern = /(\b\d+\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\beleven\b|\btwelve\b)\s*(\d+)\s*(?:bed|beds|bedroom|bedrooms|br|bdrm)\s*(?:units?|apartments?|suites?|rentals?)/g;
  while ((match = phrasePattern.exec(normalized)) !== null) {
    const count = toCount(match[1]);
    const bedrooms = Number(match[2]);
    if (!Number.isFinite(count) || !Number.isFinite(bedrooms) || count <= 0 || bedrooms < 0) continue;
    for (let i = 0; i < count; i += 1) bedroomsPerUnit.push(bedrooms);
    unitCount += count;
  }

  // Handles: "all units are 2-bedroom"
  const allUnitsPattern = /all units (?:are|being|as)?\s*(\d+)\s*(?:bed|beds|bedroom|bedrooms|br|bdrm)\b/;
  const allUnitsMatch = normalized.match(allUnitsPattern);
  if (allUnitsMatch) {
    const bedrooms = Number(allUnitsMatch[1]);
    if (Number.isFinite(bedrooms) && bedrooms >= 0) {
      return { bedroomsPerUnit: [bedrooms], unitCount: 0 };
    }
  }

  return { bedroomsPerUnit, unitCount };
}

export function parseUnitBedroomMix(text: string | null | undefined, fallbackUnits: number): ParsedBedroomMix | null {
  if (!text) return null;
  const normalized = normalizeMixText(text);
  const roomFormat = parseRoomFormatMix(normalized);
  const bedroomTokens = parseBedroomMixTokens(normalized);

  const roomCounts = collapseRepeatedPattern(roomFormat.roomCounts, Math.max(1, fallbackUnits));
  const roomUnitCount = roomCounts.length > 0 ? roomCounts.length : roomFormat.unitCount;
  const roomDerivedBedrooms = roomCounts.map((roomCount) => roomCountToBedrooms(roomCount)).filter((v): v is number => v != null);
  const bedroomSamples = roomDerivedBedrooms.length >= bedroomTokens.bedroomsPerUnit.length
    ? roomDerivedBedrooms
    : bedroomTokens.bedroomsPerUnit;

  const unitCount = Math.max(
    roomUnitCount,
    bedroomTokens.unitCount,
    Math.max(1, fallbackUnits)
  );

  if (!bedroomSamples.length) return null;

  const collapsedSamples = collapseRepeatedPattern(bedroomSamples, Math.max(1, fallbackUnits));
  const sampleUnitCount = collapsedSamples.length;
  const effectiveBedroomsPerUnit =
    bedroomTokens.unitCount === 0 && bedroomTokens.bedroomsPerUnit.length === 1 && fallbackUnits > 1
      ? Array.from({ length: fallbackUnits }, () => bedroomTokens.bedroomsPerUnit[0]!)
      : collapsedSamples;
  const totalBedrooms = effectiveBedroomsPerUnit.reduce((acc, bedrooms) => acc + bedrooms, 0);
  const avgBedroomsPerUnit = totalBedrooms / Math.max(1, effectiveBedroomsPerUnit.length);
  const scaledAvg = unitCount > effectiveBedroomsPerUnit.length
    ? totalBedrooms / unitCount
    : avgBedroomsPerUnit;

  const basisBedrooms =
    scaledAvg < 0.5 ? 0
    : scaledAvg < 1.5 ? 1
    : scaledAvg < 2.5 ? 2
    : 3;

  const uniqueRooms = Array.from(new Set(roomCounts)).sort((a, b) => a - b);
  const roomLabel = uniqueRooms.length ? uniqueRooms.map((r) => `${r}`).join(" / ") : null;
  const bedroomCountLabel = Array.from(
    effectiveBedroomsPerUnit.reduce((acc, bedrooms) => {
      acc.set(bedrooms, (acc.get(bedrooms) ?? 0) + 1);
      return acc;
    }, new Map<number, number>())
  )
    .sort((a, b) => a[0] - b[0])
    .map(([bedrooms, count]) => `${count}×${bedrooms}BR`)
    .join(" + ");
  const label = roomLabel
    ? `${unitCount} units mix (${roomLabel} rooms / ${bedroomCountLabel})`
    : `${unitCount} units mix (${bedroomCountLabel || `${basisBedrooms}+ bed basis from unit-mix text`})`;

  return {
    source: "parsed_unit_mix",
    unitCount,
    sampleUnitCount,
    isComplete: sampleUnitCount === unitCount || effectiveBedroomsPerUnit.length === unitCount,
    totalBedrooms,
    avgBedroomsPerUnit: scaledAvg,
    basisBedrooms,
    bedroomsPerUnit: effectiveBedroomsPerUnit,
    roomCounts,
    label,
  };
}

// Backward-compatible export name used in prior changes.
export function parseQuebecBedroomMix(text: string | null | undefined, fallbackUnits: number): ParsedBedroomMix | null {
  return parseUnitBedroomMix(text, fallbackUnits);
}

export function parseRoomCountToBedrooms(roomCount: number): number | null {
  return roomCountToBedrooms(roomCount);
}

export function summarizeRoomCountsAsBedrooms(roomCounts: number[]): number {
  return roomCounts.reduce((acc, roomCount) => {
    const bedrooms = roomCountToBedrooms(roomCount);
    return acc + (bedrooms ?? 0);
  }, 0);
}
