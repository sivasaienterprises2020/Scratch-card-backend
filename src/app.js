import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import publicRoutes from './routes/public.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler, notFound } from './middleware/error-handler.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const allowed = [env.FRONTEND_URL, env.ADMIN_URL];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/public/campaigns/:slug/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 }));
app.use('/api/admin/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }));

app.get('/', (_req, res) => res.json({ success: true, message: 'Reward campaign backend is running' }));
app.get('/api/health', async (_req, res, next) => {
  try {
    const { verifyDatabase } = await import('./config/database.js');
    const database = await verifyDatabase();
    res.json({ success: true, message: 'Database connected', database });
  } catch (error) {
    next(error);
  }
});

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
