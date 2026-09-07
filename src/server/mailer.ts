import { existsSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailDraft, SmtpConnectionInput } from '../shared/types.js';
import { SmtpPreset } from '../shared/types.js';
import { config } from './config.js';

const PRESETS: Record<Exclude<SmtpPreset, SmtpPreset.Custom>, { host: string; port: number; secure: boolean }> = {
  [SmtpPreset.Gmail]: { host: 'smtp.gmail.com', port: 465, secure: true },
  [SmtpPreset.Outlook]: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  [SmtpPreset.QQ]: { host: 'smtp.qq.com', port: 465, secure: true },
  [SmtpPreset.NetEase]: { host: 'smtp.163.com', port: 465, secure: true },
};

/** Creates short-lived transports from session-only credentials. */
export class Mailer {
  public async verify(input: SmtpConnectionInput): Promise<void> {
    const transporter = createTransport(input);
    try {
      await transporter.verify();
    } finally {
      transporter.close();
    }
  }

  public async send(input: SmtpConnectionInput, draft: EmailDraft, resumeFileName?: string): Promise<void> {
    const resumePath = resumeFileName ? join(config.dataDir, resumeFileName) : undefined;
    if (resumePath && !existsSync(resumePath)) throw new Error('简历附件不存在，请重新上传');
    const transporter = createTransport(input);
    try {
      await transporter.sendMail({
        from: input.fromName ? `"${input.fromName.replaceAll('"', '')}" <${input.email}>` : input.email,
        to: draft.to,
        replyTo: input.email,
        subject: draft.subject,
        text: draft.body,
        attachments: resumePath ? [{ filename: resumeFileName, path: resumePath }] : [],
      });
    } finally {
      transporter.close();
    }
  }
}

function createTransport(input: SmtpConnectionInput): Transporter {
  const endpoint = input.preset === SmtpPreset.Custom
    ? { host: input.host, port: input.port, secure: input.secure }
    : PRESETS[input.preset];
  if (!endpoint?.host || !endpoint.port) throw new Error('自定义 SMTP 需要 host 和 port');
  return nodemailer.createTransport({
    ...endpoint,
    auth: { user: input.email, pass: input.password },
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });
}
