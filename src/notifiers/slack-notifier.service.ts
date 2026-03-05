import { Injectable } from "@nestjs/common";
import { type NotificationPayload, type RestockPayload } from "./console-notifier.service";

@Injectable()
export class SlackNotifierService {
  private readonly webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL ?? undefined;

    if (this.webhookUrl) {
      console.log(`[Slack] Webhook URL configured — notifications enabled`);
    }
  }

  get isEnabled(): boolean {
    return !!this.webhookUrl;
  }

  async notifyRestock(payload: RestockPayload): Promise<void> {
    if (!this.webhookUrl) return;

    const text =
      `🔔 *재입고 알림*\n` +
      `*${payload.item.name}* 재입고됐습니다!\n` +
      `<${payload.url}|상품 보기>`;

    await this.post({ text });
  }

  async notify(payload: NotificationPayload): Promise<void> {
    if (!this.webhookUrl) return;

    const displayPrice = payload.currency
      ? `${payload.price} ${payload.currency}`
      : String(payload.price);

    const targetDisplay = payload.currency
      ? `${payload.item.targetPrice} ${payload.currency}`
      : String(payload.item.targetPrice);

    const text =
      `💰 *가격 알림*\n` +
      `*${payload.item.name}* 목표가 이하로 떨어졌습니다!\n` +
      `현재가: ${displayPrice}  (목표: ${targetDisplay})\n` +
      `<${payload.url}|상품 보기>`;

    await this.post({ text });
  }

  private async post(message: { text: string }): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });

      if (!res.ok) {
        console.error(`[Slack] Webhook returned HTTP ${res.status}: ${await res.text()}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Slack] Failed to send notification: ${msg}`);
    }
  }
}
