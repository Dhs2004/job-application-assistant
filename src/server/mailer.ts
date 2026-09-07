import { existsSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailDraft } from '../shared/types.js';
import { config, smtpConfigured } from './config.js';

/** Uses SMTP credentials from the server environment without exposing them to callers. */
export class Mailer {
  private readonly transporter?: Transporter;

  public constructor() {
    if (!smtpConfigured()) return;
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  public async verify(): Promise<void> {
    if (!this.transporter) throw new Error('SMTP 尚未配置，请先填写 .env');
    await this.transporter.verify();
  }

  public async send(draft: EmailDraft, resumeFileName?: string): Promise<void> {
    if (!this.transporter || !config.smtp.from) throw new Error('SMTP 尚未配置，请先填写 .env');
    const resumePath = resumeFileName ? join(config.dataDir, resumeFileName) : undefined;
    if (resumePath && !existsSync(resumePath)) throw new Error('简历附件不存在，请重新上传');
    await this.transporter.sendMail({
      from: config.smtp.from,
      to: draft.to,
      replyTo: config.smtp.user,
      subject: draft.subject,
      text: draft.body,
      attachments: resumePath ? [{ filename: resumeFileName, path: resumePath }] : [],
    });
  }
}
