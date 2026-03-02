import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
dotenv.config();

import userRouter from './routes/userRoutes.js';
import xapiRouter from './routes/xapiRoutes.js';
import enrollmentRouter from './routes/enrollmentRoutes.js';



//console.log('LRS_ENDPOINT:', process.env.LRS_ENDPOINT);

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'LRS_ENDPOINT', 'LRS_USERNAME', 'LRS_PASSWORD'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/user', userRouter);
app.use('/api/xapi', xapiRouter);
app.use('/api/enrollments', enrollmentRouter);

app.get('/api/health', (_, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
}));

app.use((_, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});