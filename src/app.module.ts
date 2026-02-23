import { Module } from "@nestjs/common";
import { ConfigService } from "./config/config.service";
import { HttpFetcherService } from "./fetchers/http-fetcher.service";
import { ConsoleNotifierService } from "./notifiers/console-notifier.service";
import { PriceParserService } from "./parsers/price-parser.service";
import { RunnerService } from "./runner/runner.service";
import { SchedulerService } from "./runner/scheduler.service";
import { StateService } from "./storage/state.service";

@Module({
  providers: [
    ConfigService,
    StateService,
    HttpFetcherService,
    PriceParserService,
    ConsoleNotifierService,
    SchedulerService,
    RunnerService
  ]
})
export class AppModule {}
