import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { buildDefaultAssumptions, STRATEGIES } from "@/lib/strategies";

export default async function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { evaluation: true },
  });
  if (!listing) notFound();

  const ev = listing.evaluation;
  const assumptions = buildDefaultAssumptions({
    city: listing.city,
    province: listing.province,
    postalCode: listing.postalCode,
    units: listing.units,
  });

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Link
        href="/"
        style={{ color: "#2563eb", textDecoration: "none", marginBottom: 16, display: "inline-block" }}
      >
        ← Back to dashboard
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px 0" }}>
        {listing.address}
      </h1>
      <p style={{ color: "#64748b", margin: "0 0 24px 0" }}>
        {listing.city}, {listing.province}
        {listing.postalCode && ` · ${listing.postalCode}`}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ padding: 16, backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Price</p>
          <p style={{ fontSize: 20, fontWeight: 600, margin: "4px 0 0 0" }}>
            ${listing.price.toLocaleString()}
          </p>
        </div>
        <div style={{ padding: 16, backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Combined Score</p>
          <p style={{ fontSize: 20, fontWeight: 600, margin: "4px 0 0 0" }}>
            {ev?.combinedScore?.toFixed(1) ?? "—"}
          </p>
        </div>
        <div style={{ padding: 16, backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Units</p>
          <p style={{ fontSize: 20, fontWeight: 600, margin: "4px 0 0 0" }}>
            {listing.units}
          </p>
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px 0" }}>
          CMHC assumptions
        </h2>
        <div
          style={{
            padding: 16,
            backgroundColor: "#f8fafc",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>Rent/unit:</strong> ${assumptions.avgMonthlyRentPerUnit}/mo
              <span style={{ color: "#64748b", fontSize: 12 }}> ({assumptions.rentSource})</span>
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>Vacancy:</strong> {(assumptions.vacancyRate * 100).toFixed(1)}%
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>Rent growth:</strong> {(assumptions.rentGrowthAnnual * 100).toFixed(1)}%/yr
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>Appreciation:</strong> {(assumptions.appreciationRateAnnual * 100).toFixed(1)}%/yr
            </p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px 0" }}>
          Strategies
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STRATEGIES.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "12px 16px",
                backgroundColor: "#fff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                minWidth: 160,
              }}
            >
              <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>{s.name}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {ev && (
        <div style={{ padding: 16, backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0" }}>Evaluation notes</h3>
          <p style={{ margin: 0, fontSize: 14 }}>{ev.cashflowNotes}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>{ev.equityNotes}</p>
        </div>
      )}
    </div>
  );
}
