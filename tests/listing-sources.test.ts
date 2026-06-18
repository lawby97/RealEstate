import assert from "node:assert/strict";
import test from "node:test";
import { mapCentrisListing } from "../src/lib/centris-api";
import { findBestListingMatch } from "../src/lib/listing-match";
import { computeListingCashOnCashRoi, sortByCashOnCashRoi } from "../src/lib/listing-roi";
import {
  MONTREAL_ISLAND_5PLEX_FILTER,
  passesListingSnapshotFilters,
} from "../src/lib/listing-sync";
import {
  normalizePropertyTypeOption,
  parsePropertyTypeParams,
} from "../src/lib/property-type-filters";
import {
  DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT,
  dashboardFiltersToSearchParams,
  parseDashboardFilters,
} from "../src/lib/dashboard-url-state";

test("Centris mapper extracts quintuplex fields from browser-shaped data", () => {
  const mapped = mapCentrisListing({
    centrisId: "25160737",
    title: "Quintuplex a vendre",
    address: "3925 - 3933, Rue Saint-Antoine Ouest",
    city: "Montréal",
    price: "1 300 000 $",
    units: "5",
    description: "Nombre d'unites Residentiel (5)",
    listingUrl: "https://www.centris.ca/fr/quintuplex~a-vendre~montreal-le-sud-ouest/25160737",
    photos: ["https://mspublic.centris.ca/media.ashx?id=abc.jpg"],
  });

  assert.equal(mapped.externalId, "25160737");
  assert.equal(mapped.source, "centris_ca");
  assert.equal(mapped.propertyType, "Multi-Family");
  assert.equal(mapped.units, 5);
  assert.equal(mapped.price, 1_300_000);
  assert.equal(mapped.city, "Montreal");
  assert.ok(mapped.photoUrls?.includes("mspublic.centris.ca"));
});

test("Montreal 5-plex scope accepts exact 5-unit Centris listings only", () => {
  const fivePlex = mapCentrisListing({
    centrisId: "20571260",
    title: "Quintuplex",
    address: "2661 - 2665, Rue Delisle",
    city: "Montreal",
    price: 1_049_000,
    units: 5,
  });
  const fourPlex = mapCentrisListing({
    centrisId: "12754265",
    title: "Quadruplex",
    address: "2320 - 2324, Rue Messier",
    city: "Montreal",
    price: 1_090_000,
    units: 4,
  });

  assert.equal(passesListingSnapshotFilters(fivePlex, MONTREAL_ISLAND_5PLEX_FILTER), true);
  assert.equal(passesListingSnapshotFilters(fourPlex, MONTREAL_ISLAND_5PLEX_FILTER), false);
});

test("Centris and Realtor addresses match one canonical listing", () => {
  const match = findBestListingMatch(
    {
      address: "3925 - 3933, Rue Saint-Antoine Ouest",
      city: "Montreal",
      price: 1_300_000,
      units: 5,
    },
    [
      {
        id: "realtor-29727170",
        address: "3925-3933 Rue St-Antoine O., Montreal (Le Sud-Ouest), QC H4C1B6",
        city: "Montreal",
        price: 1_300_000,
        units: 5,
      },
      {
        id: "other",
        address: "100 Rue Ontario E.",
        city: "Montreal",
        price: 1_300_000,
        units: 5,
      },
    ]
  );

  assert.equal(match?.id, "realtor-29727170");
});

test("property type filters collapse multifamily spelling variants", () => {
  assert.equal(normalizePropertyTypeOption("Multi-family"), "Multi-Family");
  assert.equal(normalizePropertyTypeOption("Multi-Family"), "Multi-Family");

  const params = new URLSearchParams();
  params.append("propertyTypes", "Multi-family");
  params.append("propertyTypes", "Triplex");
  params.append("propertyType", "Multi-Family");

  assert.deepEqual(parsePropertyTypeParams(params), ["Multi-Family", "Triplex"]);
});

test("dashboard URLs hydrate filters and serialize active view state", () => {
  const parsed = parseDashboardFilters(
    new URLSearchParams(
      "market=montreal&propertyType=Multi-family&propertyTypes=Triplex&minUnits=5&sort=score_desc&maxDownPayment=950000"
    )
  );

  assert.equal(parsed.filters.city, "Montreal");
  assert.deepEqual(parsed.filters.propertyTypes, ["Triplex", "Multi-Family"]);
  assert.equal(parsed.filters.minUnits, "5");
  assert.equal(parsed.filters.maxUnits, "");
  assert.equal(parsed.filters.sort, "score_desc");
  assert.equal(parsed.filters.maxDownPayment, 950_000);
  assert.equal(parsed.overrides.maxDownPayment, true);

  const serialized = dashboardFiltersToSearchParams(parsed.filters);
  assert.equal(serialized.get("city"), "Montreal");
  assert.deepEqual(serialized.getAll("propertyTypes"), ["Triplex", "Multi-Family"]);
  assert.equal(serialized.get("minUnits"), "5");
  assert.equal(serialized.get("maxUnits"), null);
  assert.equal(serialized.get("sort"), "score_desc");
  assert.equal(serialized.get("maxDownPayment"), "950000");
});

test("dashboard URLs preserve maximum unit caps for one-to-four unit screens", () => {
  const parsed = parseDashboardFilters(
    new URLSearchParams("propertyTypes=Multi-Family&maxUnits=4&sort=roi_desc")
  );

  assert.deepEqual(parsed.filters.propertyTypes, ["Multi-Family"]);
  assert.equal(parsed.filters.minUnits, "1");
  assert.equal(parsed.filters.maxUnits, "4");
  assert.equal(parsed.filters.sort, "roi_desc");
  assert.equal(parsed.overrides.maxDownPayment, false);

  const serialized = dashboardFiltersToSearchParams(parsed.filters);
  assert.equal(serialized.get("minUnits"), null);
  assert.equal(serialized.get("maxUnits"), "4");
  assert.equal(serialized.get("sort"), null);
  assert.deepEqual(serialized.getAll("propertyTypes"), ["Multi-Family"]);
});

test("dashboard URLs do not treat missing max down payment as zero", () => {
  const parsed = parseDashboardFilters(
    new URLSearchParams("propertyTypes=Multi-Family&minUnits=5")
  );

  assert.equal(parsed.filters.maxUnits, "");
  assert.equal(parsed.filters.maxDownPayment, DEFAULT_DASHBOARD_MAX_DOWN_PAYMENT);
  assert.equal(parsed.filters.sort, "roi_desc");
  assert.equal(parsed.overrides.maxDownPayment, false);
});

test("cash-on-cash ROI sort keeps unknown values last", () => {
  const rows = [
    { id: "unknown", roi: { cashOnCashReturn: null } },
    { id: "low", roi: { cashOnCashReturn: 2.1 } },
    { id: "high", roi: { cashOnCashReturn: 8.4 } },
  ];

  assert.deepEqual(
    sortByCashOnCashRoi([...rows], "desc").map((row) => row.id),
    ["high", "low", "unknown"]
  );
  assert.deepEqual(
    sortByCashOnCashRoi([...rows], "asc").map((row) => row.id),
    ["low", "high", "unknown"]
  );
});

test("cash-on-cash ROI is not estimated for land or parking", () => {
  const result = computeListingCashOnCashRoi({
    price: 58_000,
    city: "Montreal",
    units: 1,
    propertyType: "Vacant Land",
  });

  assert.equal(result.cashOnCashReturn, null);
  assert.deepEqual(result.cashflowYears, []);
  assert.equal(result.yearOneRoi, null);
});

test("listing ROI payload includes first three years and return bridge", () => {
  const result = computeListingCashOnCashRoi({
    price: 1_150_000,
    city: "Montreal",
    units: 5,
    propertyType: "Multi-Family",
  });

  assert.equal(result.cashflowYears.length, 3);
  assert.deepEqual(result.cashflowYears.map((year) => year.year), [1, 2, 3]);
  assert.equal(result.annualCashflow, result.cashflowYears[0].annualCashflow);
  assert.ok(result.cashflowYears.every((year) => Number.isFinite(year.annualCashflow)));
  assert.ok(result.cashflowYears.every((year) => Number.isFinite(year.monthlyCashflow)));
  assert.ok(result.cashflowYears.every((year) => Number.isFinite(year.dscr)));
  assert.ok(result.equityRequired > 0);
  assert.notEqual(result.cashOnCashReturn, null);
  assert.notEqual(result.yearOneRoi, null);
  assert.ok(Number.isFinite(result.totalYearOneReturn));
  assert.ok(Number.isFinite(result.yearOneDebtPaydown));
  assert.ok(Number.isFinite(result.yearOneAppreciation));
});
