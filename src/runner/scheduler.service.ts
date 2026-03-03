import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { HttpFetcherService } from "../fetchers/http-fetcher.service";
import { ConsoleNotifierService } from "../notifiers/console-notifier.service";
import { PriceParserService } from "../parsers/price-parser.service";
import { StockParserService } from "../parsers/stock-parser.service";
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
    @Inject(PriceParserService)
    private readonly parser: PriceParserService,
    @Inject(StockParserService)
    private readonly stockParser: StockParserService,
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

      // ── 재고 확인 ──────────────────────────────────────────────
      const stockPatterns = item.stockPatterns ?? [];
      const inStock = this.stockParser.isInStock(body, stockPatterns);

      const previousInStock = itemState.lastInStock;
      itemState.lastInStock = inStock;

      // 재입고: 이전에 품절이었고 지금 재고 있음으로 전환된 경우 알림
      if (inStock === true && previousInStock === false) {
        this.notifier.notifyRestock({ item, url: item.url });

        await this.stateService.recordNotification({
          watchId: item.id,
          notificationType: "restock",
          price: itemState.lastPrice ?? 0,
          targetPriceSnapshot: item.targetPrice,
          currency: item.currency,
          channel: "console",
          status: "sent"
        });
      }

      // 품절 확인됨 → 가격 체크 스킵
      if (inStock === false) {
        itemState.lastError = undefined;
        itemState.failures = 0;
      } else {
        // ── 가격 확인 ──────────────────────────────────────────────
        const price = this.parser.parsePrice(body, item.parser);
        parsedPrice = price;

        itemState.lastPrice = price;
        itemState.lastError = undefined;

        const minNotifyMs = ctx.global.minNotifyIntervalMinutes * 60_000;
        const lastNotifiedAt = Number(itemState.lastNotifiedAt ?? 0);
        const now = Date.now();
        const canNotify = now - lastNotifiedAt >= minNotifyMs;

        if (price <= item.targetPrice && canNotify) {
          this.notifier.notify({
            item,
            price,
            currency: item.currency,
            url: item.url
          });

          await this.stateService.recordNotification({
            watchId: item.id,
            notificationType: "price_alert",
            price,
            targetPriceSnapshot: item.targetPrice,
            currency: item.currency,
            channel: "console",
            status: "sent"
          });

          itemState.lastNotifiedAt = now;
          itemState.lastNotifiedPrice = price;
        }

        itemState.failures = 0;
      }
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
