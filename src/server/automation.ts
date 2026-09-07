import { randomUUID } from 'node:crypto';
import { createDedupeKey } from '../core/dedupe.js';
import { createEmailDraft } from '../core/email-template.js';
import { rankJobs } from '../core/matcher.js';
import type { DeliveryRecord, EmailDraft, JobMatch } from '../shared/types.js';
import { DeliveryStatus } from '../shared/types.js';
import type { AppDatabase } from './database.js';
import type { Mailer } from './mailer.js';
import { logger } from './logger.js';

/** Applies all delivery policy checks before delegating to SMTP. */
export class AutomationService {
  private running = false;

  public constructor(private readonly database: AppDatabase, private readonly mailer: Mailer) {}

  public start(): NodeJS.Timeout {
    return setInterval(() => void this.run(), 15 * 60 * 1_000).unref();
  }

  public async run(): Promise<{ sent: number; skipped: number }> {
    if (this.running) return { sent: 0, skipped: 0 };
    const settings = this.database.getSettings();
    const profile = this.database.getProfile();
    if (!settings.enabled || !settings.smtpTested || !settings.templateConfirmed || !profile) return { sent: 0, skipped: 0 };
    this.running = true;
    let sent = 0;
    let skipped = 0;
    try {
      const matches = rankJobs(profile, this.database.listJobs());
      for (const match of matches) {
        if (this.database.sentToday() >= settings.dailyLimit) break;
        if (this.database.hasSent(createDedupeKey(match.job))) {
          skipped += 1;
          continue;
        }
        if (!match.eligible || match.score < settings.threshold) {
          skipped += 1;
          continue;
        }
        const result = await this.sendMatch(match, createEmailDraft(profile, match));
        if (result.status === DeliveryStatus.Sent) sent += 1;
        else skipped += 1;
      }
      return { sent, skipped };
    } finally {
      this.running = false;
    }
  }

  public async sendMatch(match: JobMatch, draft: EmailDraft): Promise<DeliveryRecord> {
    const profile = this.database.getProfile();
    if (!profile) throw new Error('请先上传简历');
    const settings = this.database.getSettings();
    if (!match.eligible || match.score < settings.threshold) throw new Error('岗位未达到发送条件');
    if (this.database.sentToday() >= settings.dailyLimit) throw new Error('今天的投递额度已用完');
    const dedupeKey = createDedupeKey(match.job);
    if (this.database.hasSent(dedupeKey)) return this.record(match, draft, dedupeKey, DeliveryStatus.Skipped, '重复岗位，已跳过');

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.mailer.send(draft, profile.resumeFileName);
        return this.record(match, draft, dedupeKey, DeliveryStatus.Sent, 'SMTP 已接受邮件');
      } catch (error) {
        lastError = error;
        const responseCode = Number((error as { responseCode?: number }).responseCode ?? 0);
        if (responseCode >= 400 && responseCode < 500) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
      }
    }
    const responseCode = Number((lastError as { responseCode?: number }).responseCode ?? 0);
    const status = responseCode >= 400 && responseCode < 500 ? DeliveryStatus.PermanentFailure : DeliveryStatus.TemporaryFailure;
    logger.error('Application email failed', { jobId: match.job.id, responseCode });
    return this.record(match, draft, dedupeKey, status, '发送失败，请检查 SMTP 或稍后重试');
  }

  private record(match: JobMatch, draft: EmailDraft, dedupeKey: string, status: DeliveryStatus, detail: string): DeliveryRecord {
    const delivery: DeliveryRecord = {
      id: randomUUID(), jobId: match.job.id, dedupeKey, recipient: draft.to,
      subject: draft.subject, status, detail, createdAt: new Date().toISOString(),
    };
    this.database.addDelivery(delivery);
    return delivery;
  }
}
