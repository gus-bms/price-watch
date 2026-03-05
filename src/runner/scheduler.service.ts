import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { HttpFetcherService } from "../fetchers/http-fetcher.service";
import { ConsoleNotifierService } from "../notifiers/console-notifier.service";
import { SlackNotifierService } from "../notifiers/slack-notifier.service";
import { PriceParserService } from "../parsers/price-parser.service";
import { StateService } from "../storage/state.service";
import {
  type CheckTriggerSource,
  type GlobalConfig,
  type ItemState,
  type RunnerContext,
  type WatchItem
} from "./types";

@Injectable()
export class SchedulerService implements OnModuleDestroy {
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    @Inject(HttpFetcherService)
    private readonly fetcher: HttpFetcherService,
    @Inject(ConsoleNotifierService)
    private readonly notifier: ConsoleNotifierService,
    @Inject(SlackNotifierService)
    private readonly slackNotifier: SlackNotifierService,
    @Inject(PriceParserService)
    private readonly parser: PriceParserService,
    @Inject(StateService)
    private readonly stateService: StateService
  ) {}

  async runOnce(items: WatchItem[], ctx: RunnerContext): Promise<void> {
    for (const item of items) {
      await this.checkItem(item, ctx, "manual");
    }
  }

  startScheduler(items: WatchItem[], ctx: RunnerContext): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Watching ${items.length} item(s).`);

    for (const item of items) {
      this.scheduleNext(item, ctx, 0);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private scheduleNext(
    item: WatchItem,
    ctx: RunnerContext,
    delayMs: number
  ): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.executeAndReschedule(item, ctx);
    }, delayMs);

    this.timers.add(timer);
  }

  private async executeAndReschedule(
    item: WatchItem,
    ctx: RunnerContext
  ): Promise<void> {
    try {
      const itemState = await this.checkItem(item, ctx, "scheduled");
      const nextDelay = this.computeDelayMs(item, itemState, ctx.global);
      this.scheduleNext(item, ctx, nextDelay);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[${new Date().toISOString()}] scheduler error for ${item.id}: ${message}`
      );

      const fallbackDelay = Math.max(1, ctx.global.defaultIntervalMinutes) * 60_000;
      this.scheduleNext(item, ctx, fallbackDelay);
    }
  }

  private async checkItem(
    item: WatchItem,
    ctx: RunnerContext,
    triggerSource: CheckTriggerSource
  ): Promise<ItemState> {
    const itemState = this.stateService.getItemState(ctx.state, item.id);
    const startedAt = Date.now();
    let parsedPrice: number | undefined;
    let errorMessage: string | undefined;
    let responseContentType: string | undefined;

    itemState.lastCheckedAt = startedAt;

    try {
      const { body, contentType } = await this.fetcher.fetchContent(item.url, {
        userAgent: ctx.global.userAgent,
        timeoutMs: ctx.global.timeoutMs
      });
      responseContentType = contentType;

      const price = this.parser.parsePrice(body, item.parser);
      parsedPrice = price;
      itemState.lastPrice = price;
      itemState.lastError = undefined;

      // ── 품절/재고 감지 ───────────────────────────────────────────────────
      const prevOutOfStock = itemState.isOutOfStock;
      // stock 파서가 하나라도 설정돼 있는지 (로드된 item 기준)
      const hasStockTracking = !!(item.stockParser || item.sizeStockParsers?.length);

      if (item.stockParser) {
        itemState.isOutOfStock = this.parser.parseOutOfStock(body, {
          outOfStockPattern: item.stockParser.pattern,
          flags: item.stockParser.flags
        });
      }

      if (item.sizeStockParsers && item.sizeStockParsers.length > 0) {
        const sizeResults = this.parser.parseSizeStock(body, item.sizeStockParsers);
        const sizeStockJson: Record<string, boolean> = {};
        for (const { size, inStock } of sizeResults) {
          sizeStockJson[size] = inStock;
        }
        itemState.sizeStockJson = sizeStockJson;

        // 등록된 사이즈가 있으면 해당 사이즈 기준으로 품절 여부 결정
        if (item.size) {
          const targetSizeInStock = sizeStockJson[item.size];
          if (targetSizeInStock !== undefined) {
            itemState.isOutOfStock = !targetSizeInStock;
          }
        }
      }

      // stock 파서가 없으면 이전 상태를 그대로 유지한다.
      // - saveItemState가 DB의 is_out_of_stock 값을 NULL로 덮어쓰는 것을 방지
      // - saveLlmParsers 등으로 설정된 DB 값이 사라지지 않도록 보호
      if (!hasStockTracking) {
        itemState.isOutOfStock = prevOutOfStock;
      }

      // ── 알림 조건 체크 ───────────────────────────────────────────────────
      const minNotifyMs = ctx.global.minNotifyIntervalMinutes * 60_000;
      const lastNotifiedAt = Number(itemState.lastNotifiedAt ?? 0);
      const now = Date.now();
      const canNotify = now - lastNotifiedAt >= minNotifyMs;

      // 1) 가격 목표 달성 알림 (재고가 있을 때만 동작)
      // - stock 파서가 있으면: 명시적으로 재고있음(false)이어야 알림
      // - stock 파서가 없으면: undefined(알 수 없음) = 순수 가격 추적 아이템으로 간주, 기존 동작 유지
      const canSendPriceAlert = hasStockTracking
        ? itemState.isOutOfStock === false
        : itemState.isOutOfStock !== true;
      if (canSendPriceAlert && price !== undefined && price <= item.targetPrice && canNotify) {
        this.notifier.notify({ item, price, currency: item.currency, url: item.url });
        void this.slackNotifier.notify({ item, price, currency: item.currency, url: item.url });

        await this.stateService.recordNotification({
          watchId: item.id,
          price,
          targetPriceSnapshot: item.targetPrice,
          currency: item.currency,
          channel: "console",
          status: "sent"
        });

        itemState.lastNotifiedAt = now;
        itemState.lastNotifiedPrice = price;
      }

      // 2) 재입고 알림 (품절 → 재고있음 전환)
      if (
        prevOutOfStock === true &&
        itemState.isOutOfStock === false &&
        canNotify
      ) {
        this.notifier.notifyRestock({ item, url: item.url });
        void this.slackNotifier.notifyRestock({ item, url: item.url });

        await this.stateService.recordNotification({
          watchId: item.id,
          price,
          targetPriceSnapshot: item.targetPrice,
          currency: item.currency,
          channel: "console",
          status: "sent"
        });

        itemState.lastNotifiedAt = now;
      }

      itemState.failures = 0;
    } catch (error) {
      itemState.failures = Number(itemState.failures ?? 0) + 1;
      errorMessage = error instanceof Error ? error.message : String(error);
      itemState.lastError = errorMessage;
    }

    const finishedAt = Date.now();

    await this.stateService.saveItemState(item.id, itemState);
    await this.stateService.recordCheckRun({
      watchId: item.id,
      triggerSource,
      startedAt,
      finishedAt,
      success: errorMessage === undefined,
      parsedPrice,
      errorMessage,
      responseContentType
    });

    return itemState;
  }

  private computeDelayMs(
    item: WatchItem,
    itemState: ItemState,
    global: GlobalConfig
  ): number {
    const baseMinutes = Number(item.intervalMinutes ?? global.defaultIntervalMinutes);
    const baseMs = Math.max(1, baseMinutes) * 60_000;

    const failures = Math.max(0, Number(itemState.failures ?? 0));
    const maxBackoffMs = Math.max(baseMs, global.maxBackoffMinutes * 60_000);
    const backoffMs = Math.min(baseMs * Math.pow(2, failures), maxBackoffMs);
    const jitterMs = Math.floor(Math.random() * Math.min(30_000, baseMs * 0.1));

    return Math.max(1_000, backoffMs + jitterMs);
  }
}
