import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { HttpFetchError, HttpFetcherService } from "../fetchers/http-fetcher.service";
import { ConsoleNotifierService } from "../notifiers/console-notifier.service";
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
    let httpStatus: number | undefined;

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
      itemState.isOutOfStock = undefined;
      itemState.sizeStockJson = undefined;

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

      // ── 알림 조건 체크 ───────────────────────────────────────────────────
      const minNotifyMs = ctx.global.minNotifyIntervalMinutes * 60_000;
      const lastNotifiedAt = Number(itemState.lastNotifiedAt ?? 0);
      const now = Date.now();
      const canNotify = now - lastNotifiedAt >= minNotifyMs;

      // 1) 가격 목표 달성 알림 (재고가 있을 때만 동작)
      if (itemState.isOutOfStock !== true && price !== undefined && price <= item.targetPrice && canNotify) {
        this.notifier.notify({ item, price, currency: item.currency, url: item.url });

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
        const sizeLabel = item.size ? ` [사이즈: ${item.size}]` : "";
        const message = `[재입고]${sizeLabel} ${item.name} - ${price} ${item.currency ?? ""} | ${item.url}`;
        console.log(`[${new Date().toISOString()}] ${message}`);

        await this.stateService.recordNotification({
          watchId: item.id,
          price,
          targetPriceSnapshot: item.targetPrice,
          currency: item.currency,
          channel: "console",
          status: "sent",
          message
        });

        itemState.lastNotifiedAt = now;
      }

      itemState.failures = 0;
    } catch (error) {
      itemState.failures = Number(itemState.failures ?? 0) + 1;
      if (error instanceof HttpFetchError) {
        responseContentType = error.contentType;
        httpStatus = error.status;
      }
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
      responseContentType,
      httpStatus
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
