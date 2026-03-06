export type ParserCase = {
  id: string;
  name: string;
  domains: string[];
  description: string;
  pricePattern: string;
  priceFlags: string;
  stockPattern: string | null;
  stockFlags: string;
  sizeExtractorRegex: string | null;
  sizeStockPatternTemplate: string | null;
  sizeStockPatternFlags: string;
};

export const PARSER_CASES: ParserCase[] = [
  {
    id: "case-001-ralph-lauren",
    name: "Ralph Lauren Korea",
    domains: ["ralphlauren.co.kr", "www.ralphlauren.co.kr"],
    description: "Uses <li> tags and CSS classes like 'out' for stock capability.",
    pricePattern: "₩([\\d,]+)",
    priceFlags: "gi",
    // We can also match 'empty' or 'unselectable' or 'out-of-stock'.
    stockPattern: "class=\"[^\"]*(?:out|out-of-stock|sold-out|unselectable|empty)[^\"]*\"",
    stockFlags: "i",
    // Extract sizes from standard anchors in Ralph Lauren like: data-selected="M"
    sizeExtractorRegex: "data-selected=\"([^\"]+)\"",
    // Finds an li tag that DOES NOT have the out/empty/unselectable classes,
    // and contains an anchor tag with data-selected="{size}"
    sizeStockPatternTemplate: "<li[^>]*class=\"(?![^\"]*\\b(?:out|out-of-stock|sold-out|unselectable|empty)\\b)[^\"]*\"[^>]*>\\s*<a[^>]*data-selected=\"\\s*{size}\\s*\"",
    sizeStockPatternFlags: "i"
  }
];

export function findParserCaseByUrl(urlStr: string): ParserCase | null {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    
    for (const parserCase of PARSER_CASES) {
      if (parserCase.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
        return parserCase;
      }
    }
  } catch {
    // Invalid URL
  }
  return null;
}
