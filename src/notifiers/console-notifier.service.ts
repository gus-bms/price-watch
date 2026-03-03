import { Injectable } from "@nestjs/common";
import { type WatchItem } from "../runner/types";

export type NotificationPayload = {
  item: WatchItem;
  price: number;
  currency?: string | undefined;
  url: string;
};

export type RestockPayload = {
  item: WatchItem;
  url: string;
};

@Injectable()
export class ConsoleNotifierService {
  notify(payload: NotificationPayload): void {
    const displayPrice = payload.currency
      ? `${payload.price} ${payload.currency}`
      : String(payload.price);

    const timestamp = new Date().toISOString();

    console.log(
      `[ALERT ${timestamp}] ${payload.item.name} <= ${payload.item.targetPrice} (${displayPrice}) ${payload.url}`
    );
  }

  notifyRestock(payload: RestockPayload): void {
    const timestamp = new Date().toISOString();

    console.log(
      `[RESTOCK ${timestamp}] ${payload.item.name} is back in stock → ${payload.url}`
    );
  }
}
