import { Module } from "@nestjs/common";
import { ConfigService } from "./config/config.service";
import { DatabaseService } from "./database/database.service";
import { HttpFetcherService } from "./fetchers/http-fetcher.service";
import { LlmKeyService } from "./llm/llm-key.service";
import { GeminiService } from "./llm/gemini.service";
import { ParserGeneratorService } from "./llm/parser-generator.service";
import { ConsoleNotifierService } from "./notifiers/console-notifier.service";
import { SlackNotifierService } from "./notifiers/slack-notifier.service";
import { PriceParserService } from "./parsers/price-parser.service";
import { StockParserService } from "./parsers/stock-parser.service";
import { RunnerService } from "./runner/runner.service";
import { SchedulerService } from "./runner/scheduler.service";
import { StateService } from "./storage/state.service";

@Module({
  providers: [
    DatabaseService,
    ConfigService,
    StateService,
    HttpFetcherService,
    LlmKeyService,
    GeminiService,
    ParserGeneratorService,
    PriceParserService,
    StockParserService,
    ConsoleNotifierService,
    SlackNotifierService,
    SchedulerService,
    RunnerService
  ]
})
export class AppModule {}
