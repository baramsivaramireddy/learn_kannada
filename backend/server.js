const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.DATABASE_URL && process.env.db_username && process.env.db_password) {
  const databaseHost = process.env.DB_HOST || 'db.learnkannada.co.in';
  const databasePort = process.env.DB_PORT || '5432';
  const databaseName = process.env.DB_NAME || 'learnkannada';
  const username = encodeURIComponent(process.env.db_username);
  const password = encodeURIComponent(process.env.db_password);
  process.env.DATABASE_URL = `postgresql://${username}:${password}@${databaseHost}:${databasePort}/${databaseName}`;
}

const { PrismaClient } = require('@prisma/client');

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'learn-kannada-api',
  });
});

app.get('/db-health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'learn-kannada-database',
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      service: 'learn-kannada-database',
      message: 'Database connection failed',
    });
  }
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});