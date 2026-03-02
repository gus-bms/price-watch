import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { SchedulerService } from "./scheduler.service";
import { StateService } from "../storage/state.service";
import { type RunnerContext } from "./types";

export type RunnerMode = "validate" | "once" | "watch";

type CliOptions = {
  once: boolean;
  validate: boolean;
};

@Injectable()
export class RunnerService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(StateService)
    private readonly stateService: StateService,
    @Inject(SchedulerService)
    private readonly schedulerService: SchedulerService
  ) {}

  async run(argList: string[]): Promise<RunnerMode> {
    const options = this.parseCli(argList);
    const config = await this.configService.loadConfig();
    const state = await this.stateService.loadState(
      config.items.map((item) => item.id)
    );

    const ctx: RunnerContext = {
      global: config.global,
      state
    };

    if (options.validate) {
      console.log("Config OK");
      return "validate";
    }

    if (options.once) {
      await this.schedulerService.runOnce(config.items, ctx);
      return "once";
    }

    this.schedulerService.startScheduler(config.items, ctx);
    return "watch";
  }

  private parseCli(argList: string[]): CliOptions {
    return {
      once: argList.includes("--once"),
      validate: argList.includes("--validate")
    };
  }
}
