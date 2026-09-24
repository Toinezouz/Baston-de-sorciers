import { loadConfig } from "./config";
import { createGameServer } from "./server";

const server = createGameServer(loadConfig());
await server.listen();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.logger.info("shutting down", { signal });
    void server.close().then(() => process.exit(0));
  });
}
