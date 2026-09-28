import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { FakeEmailService } from './email.js';

const app = createApp({ db: pool, email: new FakeEmailService(), config });

app.listen(config.port, () => {
  console.log(`Onboard running at http://localhost:${config.port}`);
  if (config.enableDevMailbox) console.log(`Fake mailbox:        http://localhost:${config.port}/dev/mailbox`);
});
