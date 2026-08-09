import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';

async function main() {
  await migrate();
  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`PetGuardian API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
