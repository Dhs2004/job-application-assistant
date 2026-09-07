import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AiConnectionInput, AiConnectionStatus, EmailDraft, SmtpConnectionInput } from '../shared/types.js';

interface Confirmation {
  fingerprint: Buffer;
  expiresAt: number;
}

/** Keeps provider secrets and one-time confirmations out of persistent storage. */
export class SessionVault {
  private ai?: AiConnectionInput;
  private smtp?: SmtpConnectionInput;
  private readonly confirmations = new Map<string, Confirmation>();

  public setAi(input: AiConnectionInput): void {
    this.ai = { ...input };
  }

  public getAi(): AiConnectionInput {
    if (!this.ai) throw new Error('请先连接 AI Provider');
    return { ...this.ai };
  }

  public getAiStatus(): AiConnectionStatus {
    return this.ai ? { connected: true, kind: this.ai.kind, model: this.ai.model } : { connected: false };
  }

  public setSmtp(input: SmtpConnectionInput): void {
    this.smtp = { ...input };
  }

  public getSmtp(): SmtpConnectionInput {
    if (!this.smtp) throw new Error('请先连接发件邮箱');
    return { ...this.smtp };
  }

  public getSmtpStatus(): { connected: boolean; email?: string } {
    return this.smtp ? { connected: true, email: maskEmail(this.smtp.email) } : { connected: false };
  }

  public issueConfirmation(jobId: string, draft: EmailDraft, resumeFileName: string): string {
    this.prune();
    const token = randomBytes(24).toString('base64url');
    this.confirmations.set(token, { fingerprint: fingerprint(jobId, draft, resumeFileName), expiresAt: Date.now() + 10 * 60_000 });
    return token;
  }

  public consumeConfirmation(token: string, jobId: string, draft: EmailDraft, resumeFileName: string): void {
    const confirmation = this.confirmations.get(token);
    this.confirmations.delete(token);
    if (!confirmation || confirmation.expiresAt < Date.now()) throw new Error('确认已失效，请重新确认投递');
    const actual = fingerprint(jobId, draft, resumeFileName);
    if (!timingSafeEqual(confirmation.fingerprint, actual)) throw new Error('邮件内容已改变，请重新确认投递');
  }

  public clear(): void {
    this.ai = undefined;
    this.smtp = undefined;
    this.confirmations.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, value] of this.confirmations) if (value.expiresAt < now) this.confirmations.delete(token);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

function fingerprint(jobId: string, draft: EmailDraft, resumeFileName: string): Buffer {
  return createHash('sha256').update(JSON.stringify({ jobId, draft, resumeFileName })).digest();
}
