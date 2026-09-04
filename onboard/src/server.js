import { createApp } from './app.js';

const port = Number(process.env.PORT || 3317);

createApp().listen(port, () => {
  console.log(`onboard listening on http://127.0.0.1:${port}`);
});
