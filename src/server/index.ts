import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { AutomationService } from './automation.js';
import { createApi } from './api.js';
import { config } from './config.js';
import { AppDatabase } from './database.js';
import { logger } from './logger.js';
import { Mailer } from './mailer.js';

const database = new AppDatabase(config.dataDir);
const mailer = new Mailer();
const automation = new AutomationService(database, mailer);
const app = createApi(database, mailer, automation);
const webRoot = resolve(process.cwd(), 'dist');

if (existsSync(webRoot)) {
  app.use(express.static(webRoot));
  app.get('/*pagePath', (_request, response) => response.sendFile(resolve(webRoot, 'index.html')));
}

automation.start();
app.listen(config.port, '127.0.0.1', () => logger.info(`Job assistant listening on http://127.0.0.1:${config.port}`));
