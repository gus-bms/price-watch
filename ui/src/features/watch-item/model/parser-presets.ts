import { type ParserPreset } from "./types";

export const PARSER_PRESETS: ParserPreset[] = [
  // ──────────────────────────────────────────
  // USD 패턴
  // ──────────────────────────────────────────
  {
    id: "usd-dollar-sign",
    label: "USD ($) 기호",
    description: "$123.45 또는 $1,234.00 형식 매칭",
    currency: "USD",
    patterns: [
      "\\$([0-9,.]+)",
      "price[^0-9$]*\\$([0-9,.]+)",
      "sale[^0-9$]*\\$([0-9,.]+)",
      "now[^0-9$]*\\$([0-9,.]+)"
    ]
  },
  {
    id: "usd-text-code",
    label: "USD 텍스트 코드",
    description: "USD 123.45 또는 123.45 USD 형식 매칭",
    currency: "USD",
    patterns: [
      "USD\\s*([0-9,.]+)",
      "([0-9,.]+)\\s*USD",
      "US\\$\\s*([0-9,.]+)"
    ]
  },
  {
    id: "usd-schema-json",
    label: "USD Schema/JSON-LD",
    description: "Schema.org itemprop 및 JSON-LD price 필드",
    currency: "USD",
    patterns: [
      "itemprop=[\"']price[\"'][^>]*content=[\"']([0-9,.]+)",
      "content=[\"']([0-9,.]+)[\"'][^>]*itemprop=[\"']price",
      "\"currentPrice\"\\s*:\\s*([0-9,.]+)",
      "\"regularPrice\"\\s*:\\s*([0-9,.]+)",
      "\"listPrice\"\\s*:\\s*([0-9,.]+)",
      "\"amount\"\\s*:\\s*\"([0-9,.]+)\""
    ]
  },
  {
    id: "usd-data-attribute",
    label: "USD HTML data 속성",
    description: "data-price 등 HTML 속성에서 USD 가격 추출",
    currency: "USD",
    patterns: [
      "data-price=[\"']([0-9,.]+)",
      "data-sale-price=[\"']([0-9,.]+)",
      "data-regular-price=[\"']([0-9,.]+)",
      "data-final-price=[\"']([0-9,.]+)"
    ]
  },

  // ──────────────────────────────────────────
  // KRW 패턴
  // ──────────────────────────────────────────
  {
    id: "krw-product-page",
    label: "KRW 판매가/원",
    description: "판매가/원 형식의 한국 쇼핑몰 페이지",
    currency: "KRW",
    patterns: [
      "판매가[^0-9]*([0-9,]+)\\s*원",
      "([0-9,]+)\\s*원"
    ]
  },
  {
    id: "krw-won-symbol",
    label: "KRW ₩ 기호",
    description: "₩169,000 형식 매칭",
    currency: "KRW",
    patterns: [
      "₩\\s*([0-9,]+)",
      "₩([0-9]+)"
    ]
  },
  {
    id: "krw-korean-labels",
    label: "KRW 한국어 가격 라벨",
    description: "할인가/정가/구매가/최저가/가격 등 다양한 한국어 가격 텍스트",
    currency: "KRW",
    patterns: [
      "할인가[^0-9]*([0-9,]+)\\s*원",
      "정가[^0-9]*([0-9,]+)\\s*원",
      "구매가[^0-9]*([0-9,]+)\\s*원",
      "최저가[^0-9]*([0-9,]+)\\s*원",
      "가격[^0-9]*([0-9,]+)\\s*원",
      "특가[^0-9]*([0-9,]+)\\s*원",
      "회원가[^0-9]*([0-9,]+)\\s*원"
    ]
  },
  {
    id: "krw-json",
    label: "KRW JSON (네이버·쿠팡 등)",
    description: "한국 쇼핑몰 JSON 응답에서 가격 추출",
    currency: "KRW",
    patterns: [
      "\"lprice\"\\s*:\\s*\"([0-9,]+)\"",
      "\"price\"\\s*:\\s*([0-9]+)",
      "\"salePrice\"\\s*:\\s*([0-9]+)",
      "\"basePrice\"\\s*:\\s*([0-9]+)",
      "\"discountedPrice\"\\s*:\\s*([0-9]+)"
    ]
  },
  {
    id: "krw-text-code",
    label: "KRW 텍스트 코드",
    description: "KRW 169000 또는 169000 KRW 형식 매칭",
    currency: "KRW",
    patterns: [
      "KRW\\s*([0-9,]+)",
      "([0-9,]+)\\s*KRW"
    ]
  },

  // ──────────────────────────────────────────
  // 공통 / 범용 패턴
  // ──────────────────────────────────────────
  {
    id: "json-price-field",
    label: "JSON price 필드",
    description: "JSON 페이로드의 price/salePrice 필드 매칭",
    currency: "USD",
    patterns: [
      "\\\"price\\\"\\s*:\\s*\\\"?([0-9,.]+)",
      "\\\"salePrice\\\"\\s*:\\s*\\\"?([0-9,.]+)"
    ]
  },
  {
    id: "generic-number",
    label: "범용 숫자",
    description: "형식화된 숫자의 폴백 패턴 (예: 1,234.56)",
    currency: "USD",
    patterns: ["([0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]+)?)"]
  }
];
