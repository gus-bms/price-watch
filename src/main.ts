import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RunnerService, type RunnerMode } from "./runner/runner.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const runner = app.get(RunnerService);
    const mode = await runner.run(process.argv.slice(2));

    if (mode !== "watch") {
      await app.close();
      return;
    }

    registerShutdownHooks(app, mode);
  } catch (error) {
    await app.close();
    throw error;
  }
}

function registerShutdownHooks(
  app: { close: () => Promise<void> },
  mode: RunnerMode
) {
  if (mode !== "watch") {
    return;
  }

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(
      `[${new Date().toISOString()}] Received ${signal}. Shutting down.`
    );
    await app.close();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error && error.stack ? error.stack : String(error);
  console.error(message);
  process.exitCode = 1;
});
