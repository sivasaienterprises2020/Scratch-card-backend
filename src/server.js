import app from './app.js';
import { env } from './config/env.js';
import { verifyDatabase } from './config/database.js';

if (!process.env.VERCEL) {
  verifyDatabase()
    .then(() => {
      app.listen(env.PORT, () => console.log(`Backend running at http://localhost:${env.PORT}`));
    })
    .catch((error) => {
      console.error('Could not connect to the database:', error.message);
      process.exit(1);
    });
}

export default app;
