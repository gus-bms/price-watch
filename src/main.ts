import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { startApiServer } from "./api/server";
import { RunnerService, type RunnerMode } from "./runner/runner.service";

async function bootstrap() {
  const args = process.argv.slice(2);

  if (args.includes("--api")) {
    const apiServer = await startApiServer();
    registerApiShutdownHooks(apiServer);
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const runner = app.get(RunnerService);
    const mode = await runner.run(args);

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

function registerApiShutdownHooks(apiServer: { close: () => Promise<void> }) {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(
      `[${new Date().toISOString()}] Received ${signal}. Shutting down API server.`
    );

    await apiServer.close();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
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
