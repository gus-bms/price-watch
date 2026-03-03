import { Module } from "@nestjs/common";
import { ConfigService } from "./config/config.service";
import { DatabaseService } from "./database/database.service";
import { HttpFetcherService } from "./fetchers/http-fetcher.service";
import { ConsoleNotifierService } from "./notifiers/console-notifier.service";
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
    PriceParserService,
    StockParserService,
    ConsoleNotifierService,
    SchedulerService,
    RunnerService
  ]
})
export class AppModule {}
