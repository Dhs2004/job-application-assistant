import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AutomationSettings, CandidateProfile, DeliveryRecord, JobRecord } from '../shared/types.js';
import { DeliveryStatus } from '../shared/types.js';

const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: false,
  threshold: 78,
  dailyLimit: 5,
  templateConfirmed: false,
  smtpTested: false,
};

/** Owns the application's SQLite records and keeps SQL out of HTTP handlers. */
export class AppDatabase {
  private readonly database: DatabaseSync;

  public constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(join(dataDir, 'assistant.sqlite'));
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, dedupe_key TEXT NOT NULL,
        recipient TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL,
        detail TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS delivery_dedupe ON deliveries(dedupe_key, status);
    `);
  }

  public getProfile(): CandidateProfile | undefined {
    return this.getState<CandidateProfile>('profile');
  }

  public saveProfile(profile: CandidateProfile): void {
    this.setState('profile', profile);
  }

  public getSettings(): AutomationSettings {
    return { ...DEFAULT_SETTINGS, ...this.getState<Partial<AutomationSettings>>('settings') };
  }

  public saveSettings(settings: AutomationSettings): void {
    this.setState('settings', settings);
  }

  public upsertJobs(jobs: JobRecord[]): void {
    const insert = this.database.prepare(`
      INSERT INTO jobs (id, payload, imported_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, imported_at = excluded.imported_at
    `);
    this.database.exec('BEGIN');
    try {
      jobs.forEach((job) => insert.run(job.id, JSON.stringify(job), job.importedAt));
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public listJobs(): JobRecord[] {
    return this.database.prepare('SELECT payload FROM jobs ORDER BY imported_at DESC').all()
      .map((row) => JSON.parse(String((row as { payload: string }).payload)) as JobRecord);
  }

  public addDelivery(delivery: DeliveryRecord): void {
    this.database.prepare(`
      INSERT INTO deliveries (id, job_id, dedupe_key, recipient, subject, status, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(delivery.id, delivery.jobId, delivery.dedupeKey, delivery.recipient, delivery.subject, delivery.status, delivery.detail, delivery.createdAt);
  }

  public listDeliveries(): DeliveryRecord[] {
    return this.database.prepare(`
      SELECT id, job_id AS jobId, dedupe_key AS dedupeKey, recipient, subject, status, detail, created_at AS createdAt
      FROM deliveries ORDER BY created_at DESC
    `).all() as unknown as DeliveryRecord[];
  }

  public hasSent(dedupeKey: string): boolean {
    return Boolean(this.database.prepare('SELECT 1 FROM deliveries WHERE dedupe_key = ? AND status = ? LIMIT 1')
      .get(dedupeKey, DeliveryStatus.Sent));
  }

  public sentToday(): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const row = this.database.prepare('SELECT COUNT(*) AS count FROM deliveries WHERE status = ? AND created_at >= ?')
      .get(DeliveryStatus.Sent, start.toISOString()) as { count: number };
    return Number(row.count);
  }

  public clear(): void {
    this.database.exec('DELETE FROM deliveries; DELETE FROM jobs; DELETE FROM state; VACUUM;');
  }

  private getState<T>(key: string): T | undefined {
    const row = this.database.prepare('SELECT value FROM state WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as T : undefined;
  }

  private setState(key: string, value: unknown): void {
    this.database.prepare(`
      INSERT INTO state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  }
}
