export type StockPreset = {
  id: string;
  label: string;
  description: string;
  patterns: string[];
};

export const STOCK_PRESETS: StockPreset[] = [
  {
    id: "stock-korean-common",
    label: "한국어 품절",
    description: "품절 / 일시품절 / 재고없음 / 구매불가 / 재입고 알림 신청",
    patterns: [
      "품절",
      "일시품절",
      "재고\\s*없음",
      "구매불가",
      "품절된 상품",
      "재입고 알림 신청",
      "재입고\\s*알림"
    ]
  },
  {
    id: "stock-english-common",
    label: "Sold Out (영어)",
    description: "sold out / out of stock / unavailable",
    patterns: ["sold\\s*out", "out of stock", "unavailable", "notify me when available"]
  },
  {
    id: "stock-html-disabled",
    label: "버튼 비활성화",
    description: "장바구니·구매 버튼 disabled 속성",
    patterns: [
      "<button[^>]*disabled[^>]*>[^<]*(장바구니|구매|add to cart)",
      "data-stock=[\"']out[\"']"
    ]
  }
];
