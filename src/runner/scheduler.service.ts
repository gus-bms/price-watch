import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { HttpFetcherService } from "../fetchers/http-fetcher.service";
import { ConsoleNotifierService } from "../notifiers/console-notifier.service";
import { PriceParserService } from "../parsers/price-parser.service";
import { StateService } from "../storage/state.service";
import {
  type GlobalConfig,
  type ItemState,
  type RunnerContext,
  type WatchItem
} from "./types";

@Injectable()
export class SchedulerService implements OnModuleDestroy {
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly fetcher: HttpFetcherService,
    private readonly notifier: ConsoleNotifierService,
    private readonly parser: PriceParserService,
    private readonly stateService: StateService
  ) {}

  async runOnce(items: WatchItem[], ctx: RunnerContext): Promise<void> {
    for (const item of items) {
      await this.checkItem(item, ctx);
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
      const itemState = await this.checkItem(item, ctx);
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

  private async checkItem(item: WatchItem, ctx: RunnerContext): Promise<ItemState> {
    const itemState = this.stateService.getItemState(ctx.state, item.id);
    const now = Date.now();

    try {
      const { body } = await this.fetcher.fetchContent(item.url, {
        userAgent: ctx.global.userAgent,
        timeoutMs: ctx.global.timeoutMs
      });

      const price = this.parser.parsePrice(body, item.parser);
      itemState.lastPrice = price;
      itemState.lastCheckedAt = now;
      itemState.lastError = undefined;

      const minNotifyMs = ctx.global.minNotifyIntervalMinutes * 60_000;
      const lastNotifiedAt = Number(itemState.lastNotifiedAt ?? 0);
      const canNotify = now - lastNotifiedAt >= minNotifyMs;

      if (price <= item.targetPrice && canNotify) {
        this.notifier.notify({
          item,
          price,
          currency: item.currency,
          url: item.url
        });

        itemState.lastNotifiedAt = now;
        itemState.lastNotifiedPrice = price;
      }

      itemState.failures = 0;
    } catch (error) {
      itemState.failures = Number(itemState.failures ?? 0) + 1;
      itemState.lastError = error instanceof Error ? error.message : String(error);
    }

    await this.stateService.saveState(ctx.statePath, ctx.state);
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
