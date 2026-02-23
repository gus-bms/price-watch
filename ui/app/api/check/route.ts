import { NextResponse } from "next/server";
import { checkPriceFromUrl } from "../../lib/priceCheck";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const url = typeof payload.url === "string" ? payload.url : "";
    const parser = payload.parser;
    const parsers = Array.isArray(payload.parsers) ? payload.parsers : undefined;
    const currency = typeof payload.currency === "string" ? payload.currency : undefined;

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    const result = await checkPriceFromUrl({
      url,
      parser,
      parsers,
      timeoutMs: payload.timeoutMs,
      userAgent: payload.userAgent,
      currency
    });

    return NextResponse.json({
      price: result.price,
      matchedParser: result.matchedParser,
      confidence: result.confidence,
      verifiedByRecheck: result.verifiedByRecheck
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
