import { Injectable } from "@nestjs/common";
import { join, resolve } from "node:path";
import { ConfigService } from "../config/config.service";
import { SchedulerService } from "./scheduler.service";
import { StateService } from "../storage/state.service";
import { type RunnerContext } from "./types";

export type RunnerMode = "validate" | "once" | "watch";

type CliOptions = {
  configPath: string;
  statePath: string;
  once: boolean;
  validate: boolean;
};

@Injectable()
export class RunnerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly stateService: StateService,
    private readonly schedulerService: SchedulerService
  ) {}

  async run(argList: string[]): Promise<RunnerMode> {
    const options = this.parseCli(argList);
    const config = await this.configService.loadConfig(options.configPath);
    const state = await this.stateService.loadState(options.statePath);

    const ctx: RunnerContext = {
      global: config.global,
      state,
      statePath: options.statePath
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
    const rootDir = resolve(process.cwd());

    const configPath =
      this.getArgValue(argList, "--config") ??
      join(rootDir, "config", "watchlist.json");

    const statePath =
      this.getArgValue(argList, "--state") ??
      join(rootDir, "data", "state.json");

    return {
      configPath,
      statePath,
      once: argList.includes("--once"),
      validate: argList.includes("--validate")
    };
  }

  private getArgValue(argList: string[], name: string): string | null {
    const index = argList.indexOf(name);
    if (index === -1) {
      return null;
    }

    const value = argList[index + 1];
    if (!value || value.startsWith("--")) {
      return null;
    }

    return value;
  }
}
