import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CandidateProfile, DeliveryRecord, DiscoveredJob } from '../shared/types.js';
import { DeliveryStatus } from '../shared/types.js';

const SCHEMA_VERSION = 2;

/** Owns non-secret local records and migrates legacy Feed data out of the AI workflow. */
export class AppDatabase {
  private readonly database: DatabaseSync;

  public constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(join(dataDir, 'assistant.sqlite'));
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, dedupe_key TEXT NOT NULL,
        recipient TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL,
        detail TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS delivery_dedupe ON deliveries(dedupe_key, status);
    `);
    this.migrate();
  }

  public getProfile(): CandidateProfile | undefined { return this.getState<CandidateProfile>('profile'); }
  public saveProfile(profile: CandidateProfile): void { this.setState('profile', profile); }

  public replaceJobs(jobs: DiscoveredJob[]): void {
    const insert = this.database.prepare('INSERT INTO jobs (id, payload, imported_at) VALUES (?, ?, ?)');
    this.database.exec('BEGIN');
    try {
      this.database.exec('DELETE FROM jobs');
      jobs.forEach((job) => insert.run(job.id, JSON.stringify(job), job.searchedAt));
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public listJobs(): DiscoveredJob[] {
    return this.database.prepare('SELECT payload FROM jobs ORDER BY imported_at DESC').all()
      .map((row) => JSON.parse(String((row as { payload: string }).payload)) as DiscoveredJob);
  }

  public findJob(id: string): DiscoveredJob | undefined { return this.listJobs().find((job) => job.id === id); }

  public addDelivery(delivery: DeliveryRecord): void {
    this.database.prepare(`INSERT INTO deliveries
      (id, job_id, dedupe_key, recipient, subject, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(delivery.id, delivery.jobId, delivery.dedupeKey, delivery.recipient, delivery.subject, delivery.status, delivery.detail, delivery.createdAt);
  }

  public listDeliveries(): DeliveryRecord[] {
    return this.database.prepare(`SELECT id, job_id AS jobId, dedupe_key AS dedupeKey, recipient, subject,
      status, detail, created_at AS createdAt FROM deliveries ORDER BY created_at DESC`).all() as unknown as DeliveryRecord[];
  }

  public hasSent(dedupeKey: string): boolean {
    return Boolean(this.database.prepare('SELECT 1 FROM deliveries WHERE dedupe_key = ? AND status = ? LIMIT 1').get(dedupeKey, DeliveryStatus.Sent));
  }

  public clear(): void { this.database.exec('DELETE FROM deliveries; DELETE FROM jobs; DELETE FROM state; VACUUM;'); }

  private migrate(): void {
    const row = this.database.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | undefined;
    const version = Number(row?.value ?? 1);
    if (version < 2) this.database.exec("DELETE FROM jobs; DELETE FROM state WHERE key IN ('profile', 'settings');");
    this.database.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(String(SCHEMA_VERSION));
  }

  private getState<T>(key: string): T | undefined {
    const row = this.database.prepare('SELECT value FROM state WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as T : undefined;
  }

  private setState(key: string, value: unknown): void {
    this.database.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  }
}
