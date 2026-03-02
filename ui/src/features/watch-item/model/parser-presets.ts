import { type ParserPreset } from "./types";

export const PARSER_PRESETS: ParserPreset[] = [
  {
    id: "usd-dollar-sign",
    label: "USD ($)",
    description: "Matches $123.45 or $1,234.00",
    currency: "USD",
    patterns: ["\\$([0-9,.]+)", "price[^0-9$]*\\$([0-9,.]+)"]
  },
  {
    id: "krw-product-page",
    label: "KRW",
    description: "판매가/원 format for KRW pages",
    currency: "KRW",
    patterns: ["판매가[^0-9]*([0-9,]+)\\s*원", "([0-9,]+)\\s*원"]
  },
  {
    id: "json-price-field",
    label: "JSON price",
    description: "Matches price fields from JSON payload",
    currency: "USD",
    patterns: [
      "\\\"price\\\"\\s*:\\s*\\\"?([0-9,.]+)",
      "\\\"salePrice\\\"\\s*:\\s*\\\"?([0-9,.]+)"
    ]
  },
  {
    id: "generic-number",
    label: "Generic number",
    description: "Fallback pattern for formatted numbers",
    currency: "USD",
    patterns: ["([0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]+)?)"]
  }
];
