/**
 * Zone-level CMHC data from apt_rents_by_zone and apt_vacancy_by_zone.
 */

import type { BedroomRents } from "./cmhc-data";
import rawData from "@/data/cmhc-2025-raw.json";

type ZoneEntry = {
  label: string;
  total_25?: number;
  studio_25?: number;
  oneBed_25?: number;
  twoBed_25?: number;
  threeBedPlus_25?: number;
  raw?: number[];
  partial?: boolean;
};

const data = rawData as Record<string, {
  apt_rents_by_zone?: ZoneEntry[];
  apt_vacancy_by_zone?: ZoneEntry[];
}>;

function isSubZoneLabel(label: string): boolean {
  return /^Zone \d+ - /.test(label) && !label.includes("(Zones") && !label.includes("CMA");
}

function parseZoneRents(entry: ZoneEntry): BedroomRents | null {
  if (entry.total_25 != null) {
    return {
      studio: entry.studio_25,
      oneBed: entry.oneBed_25,
      twoBed: entry.twoBed_25,
      threeBedPlus: entry.threeBedPlus_25,
      total: entry.total_25,
    };
  }
  if (entry.raw && entry.raw.length >= 5) {
    const last5 = entry.raw.slice(-5);
    return {
      studio: last5[0],
      oneBed: last5[1],
      twoBed: last5[2],
      threeBedPlus: last5[3],
      total: last5[4],
    };
  }
  return null;
}

function parseZoneVacancy(entry: ZoneEntry): number | null {
  if (entry.total_25 != null) return entry.total_25 / 100;
  if (entry.raw && entry.raw.length > 0) {
    const vals = entry.raw.filter((v) => typeof v === "number");
    if (vals.length > 0) return vals.reduce((a, b) => a + b, 0) / vals.length / 100;
  }
  return null;
}

export function getZoneRents(cma: string, zoneLabel: string): BedroomRents | null {
  const cmaData = data[cma];
  if (!cmaData?.apt_rents_by_zone) return null;
  const entry = cmaData.apt_rents_by_zone.find(
    (e) => isSubZoneLabel(e.label) && e.label === zoneLabel
  );
  return entry ? parseZoneRents(entry) : null;
}

export function getZoneVacancy(cma: string, zoneLabel: string): number | null {
  const cmaData = data[cma];
  if (!cmaData?.apt_vacancy_by_zone) return null;
  const entry = cmaData.apt_vacancy_by_zone.find(
    (e) => isSubZoneLabel(e.label) && e.label === zoneLabel
  );
  return entry ? parseZoneVacancy(entry) : null;
}
