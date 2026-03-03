import { Injectable } from "@nestjs/common";

@Injectable()
export class StockParserService {
  /**
   * 품절 여부를 판단합니다.
   *
   * - patterns 중 하나라도 body에 매칭되면 → false (구매 불가 / 품절)
   * - 아무 패턴도 매칭되지 않으면        → true  (구매 가능)
   * - patterns가 빈 배열이면             → undefined (설정 없음, 판별 불가)
   */
  isInStock(body: string, patterns: string[]): boolean | undefined {
    if (patterns.length === 0) {
      return undefined;
    }

    const outOfStock = patterns.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(body);
      } catch {
        return false;
      }
    });

    return !outOfStock;
  }
}
