import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createApi } from './api.js';
import { config } from './config.js';
import { AppDatabase } from './database.js';
import { logger } from './logger.js';
import { Mailer } from './mailer.js';
import { SessionVault } from './session-vault.js';

const database = new AppDatabase(config.dataDir);
const mailer = new Mailer();
const vault = new SessionVault();
const app = createApi(database, mailer, vault);
const webRoot = resolve(process.cwd(), 'dist');

if (existsSync(webRoot)) {
  app.use(express.static(webRoot));
  app.get('/*pagePath', (_request, response) => response.sendFile(resolve(webRoot, 'index.html')));
}

app.listen(config.port, '127.0.0.1', (error?: Error) => {
  if (error) {
    logger.error(`Job assistant failed to listen: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  logger.info(`Job assistant listening on http://127.0.0.1:${config.port}`);
});
