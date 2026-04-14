import { NextResponse } from "next/server";
import { loadAll, AXIS_OPTIONS } from "@/lib/data-loader";
import { filterFormats } from "@/lib/filter";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hook = searchParams.get("hook") || undefined;
  const tone = searchParams.get("tone") || undefined;
  const structure = searchParams.get("structure") || undefined;

  const { formats } = loadAll();
  const { exact, partial } = filterFormats(formats, { hook, tone, structure });

  return NextResponse.json({
    axis_options: AXIS_OPTIONS,
    exact: exact.map(formatSummary),
    partial: partial.slice(0, 6).map(formatSummary),
    total: formats.length,
  });
}

function formatSummary(f: any) {
  return {
    id: f.id,
    name: f.name,
    one_liner: f.one_liner,
    axes: f.axes,
    slides: `${f.min_slides}〜${f.max_slides}`,
    enterprise_caution: f.enterprise_caution,
    risk_count: f.risk_flags?.length || 0,
    example_topics: f.example_topics || [],
  };
}
