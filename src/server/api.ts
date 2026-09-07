import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { createEmailDraft } from '../core/email-template.js';
import { rankJobs } from '../core/matcher.js';
import { termsFromText, uniqueTerms } from '../core/text.js';
import type { AutomationSettings, CandidateProfile, DashboardData, EmailDraft, JobMatch } from '../shared/types.js';
import { RemotePreference, ResumeFileType } from '../shared/types.js';
import type { AutomationService } from './automation.js';
import { config, smtpConfigured } from './config.js';
import type { AppDatabase } from './database.js';
import { importJsonFeed } from './job-sources.js';
import type { Mailer } from './mailer.js';
import { parseAndStoreResume } from './resume.js';
import { SAMPLE_JOBS } from './sample-jobs.js';

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.nativeEnum(ResumeFileType),
  dataBase64: z.string().min(1),
  skills: z.array(z.string()).max(100).default([]),
  yearsExperience: z.number().min(0).max(70),
  targetRoles: z.array(z.string()).max(30).default([]),
  locations: z.array(z.string()).max(30).default([]),
  remotePreference: z.nativeEnum(RemotePreference),
  minimumSalary: z.number().nonnegative().optional(),
  language: z.enum(['zh', 'en']).default('zh'),
});

const profilePatchSchema = z.object({
  resumeText: z.string().trim().min(20).max(100_000),
  skills: z.array(z.string()).max(100),
  yearsExperience: z.number().min(0).max(70),
  targetRoles: z.array(z.string()).max(30),
  locations: z.array(z.string()).max(30),
  remotePreference: z.nativeEnum(RemotePreference),
  minimumSalary: z.number().nonnegative().optional(),
  language: z.enum(['zh', 'en']),
});

const settingsSchema = z.object({
  enabled: z.boolean(), threshold: z.number().int().min(50).max(100),
  dailyLimit: z.number().int().min(1).max(30), templateConfirmed: z.boolean(),
});

export function createApi(database: AppDatabase, mailer: Mailer, automation: AutomationService): express.Express {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/dashboard', (_request, response) => response.json(buildDashboard(database)));

  app.post('/api/profile', asyncHandler(async (request, response) => {
    const input = profileSchema.parse(request.body);
    const resume = await parseAndStoreResume(input, config.dataDir);
    const profile: CandidateProfile = {
      name: input.name, email: input.email, resumeFileName: resume.storedFileName, resumeText: resume.text,
      skills: uniqueTerms(input.skills.length ? input.skills : termsFromText(resume.text)),
      yearsExperience: input.yearsExperience, targetRoles: uniqueTerms(input.targetRoles),
      locations: uniqueTerms(input.locations), remotePreference: input.remotePreference,
      minimumSalary: input.minimumSalary, language: input.language,
    };
    database.saveProfile(profile);
    response.status(201).json(buildDashboard(database));
  }));

  app.patch('/api/profile', asyncHandler(async (request, response) => {
    const current = database.getProfile();
    if (!current) throw new Error('请先上传简历');
    const patch = profilePatchSchema.parse(request.body);
    database.saveProfile({ ...current, ...patch, skills: uniqueTerms(patch.skills), targetRoles: uniqueTerms(patch.targetRoles), locations: uniqueTerms(patch.locations) });
    response.json(buildDashboard(database));
  }));

  app.post('/api/jobs/sample', (_request, response) => {
    database.upsertJobs(SAMPLE_JOBS);
    response.status(201).json(buildDashboard(database));
  });

  app.post('/api/jobs/feed', asyncHandler(async (request, response) => {
    const { url } = z.object({ url: z.string().url().max(2_000) }).parse(request.body);
    const jobs = await importJsonFeed(url);
    database.upsertJobs(jobs);
    response.status(201).json({ imported: jobs.length, dashboard: buildDashboard(database) });
  }));

  app.get('/api/jobs/:jobId/draft', (request, response) => {
    const context = findMatch(database, routeParam(request.params.jobId));
    response.json(createEmailDraft(context.profile, context.match));
  });

  app.post('/api/mail/test', asyncHandler(async (request, response) => {
    const profile = database.getProfile();
    if (!profile) throw new Error('请先上传简历');
    const { recipient } = z.object({ recipient: z.string().email() }).parse(request.body);
    await mailer.verify();
    await mailer.send({ to: recipient, subject: '投递舱 SMTP 测试成功', body: `你好 ${profile.name}，\n\nSMTP 连接和发件配置可以正常工作。此邮件没有附带简历。` });
    const settings = database.getSettings();
    database.saveSettings({ ...settings, smtpTested: true, enabled: false });
    response.json(buildDashboard(database));
  }));

  app.put('/api/automation', (request, response) => {
    const input = settingsSchema.parse(request.body);
    const current = database.getSettings();
    if (input.enabled && (!current.smtpTested || !input.templateConfirmed)) {
      throw new Error('开启自动发送前必须完成 SMTP 测试并确认邮件模板');
    }
    const settings: AutomationSettings = { ...input, smtpTested: current.smtpTested };
    database.saveSettings(settings);
    response.json(buildDashboard(database));
    if (settings.enabled) setImmediate(() => void automation.run());
  });

  app.post('/api/automation/run', asyncHandler(async (_request, response) => response.json(await automation.run())));

  app.post('/api/jobs/:jobId/send', asyncHandler(async (request, response) => {
    const settings = database.getSettings();
    if (!settings.smtpTested) throw new Error('发送前必须先完成 SMTP 测试');
    const { match } = findMatch(database, routeParam(request.params.jobId));
    const draft = z.object({ to: z.string().email(), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(20).max(20_000) })
      .parse(request.body) as EmailDraft;
    if (draft.to.toLowerCase() !== match.job.applyEmail?.toLowerCase()) throw new Error('收件人必须是岗位公开的申请邮箱');
    response.status(201).json(await automation.sendMatch(match, draft));
  }));

  app.get('/api/export', (_request, response) => {
    const rows = database.listDeliveries();
    const csv = ['时间,岗位ID,收件人,主题,状态,说明', ...rows.map((row) =>
      [row.createdAt, row.jobId, row.recipient, row.subject, row.status, row.detail].map(csvCell).join(','))].join('\n');
    response.type('text/csv').attachment('application-history.csv').send(`\ufeff${csv}`);
  });

  app.delete('/api/data', (_request, response) => {
    database.saveSettings({ ...database.getSettings(), enabled: false });
    database.clear();
    if (existsSync(config.dataDir)) {
      for (const name of readdirSync(config.dataDir)) {
        if (/^resume\.(pdf|docx|txt)$/.test(name)) unlinkSync(join(config.dataDir, name));
      }
    }
    response.status(204).send();
  });

  app.use((error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    response.status(400).json({ error: errorMessage(error) });
  });
  return app;
}

function buildDashboard(database: AppDatabase): DashboardData {
  const profile = database.getProfile();
  return {
    profile,
    matches: profile ? rankJobs(profile, database.listJobs()) : [],
    deliveries: database.listDeliveries(), settings: database.getSettings(),
    smtp: { configured: smtpConfigured(), from: maskEmail(config.smtp.user) },
  };
}

function findMatch(database: AppDatabase, jobId: string): { profile: CandidateProfile; match: JobMatch } {
  const profile = database.getProfile();
  if (!profile) throw new Error('请先上传简历');
  const match = rankJobs(profile, database.listJobs()).find((item) => item.job.id === jobId);
  if (!match) throw new Error('岗位不存在');
  return { profile, match };
}

function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  return domain ? `${local.slice(0, 2)}***@${domain}` : undefined;
}

function routeParam(value: string | string[]): string {
  if (typeof value !== 'string') throw new Error('无效的岗位 ID');
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? '输入格式错误';
  if (error instanceof Error) return error.message;
  return '请求失败';
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function asyncHandler(handler: (request: Request, response: Response) => Promise<unknown>) {
  return (request: Request, response: Response, next: express.NextFunction) => void handler(request, response).catch(next);
}
