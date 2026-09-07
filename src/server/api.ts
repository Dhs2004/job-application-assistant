import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { createDedupeKey } from '../core/dedupe.js';
import { uniqueTerms } from '../core/text.js';
import type { CandidateProfile, DashboardData, DiscoveredJob, EmailDraft } from '../shared/types.js';
import { AiApiStyle, AiProviderKind, DeliveryStatus, ResumeFileType, SmtpPreset } from '../shared/types.js';
import { AiProviderClient } from './ai-provider.js';
import { config } from './config.js';
import type { AppDatabase } from './database.js';
import type { Mailer } from './mailer.js';
import { parseAndStoreResume } from './resume.js';
import { createSampleJobs } from './sample-jobs.js';
import type { SessionVault } from './session-vault.js';

const aiConnectionSchema = z.object({
  kind: z.nativeEnum(AiProviderKind), apiKey: z.string().trim().min(8).max(500), model: z.string().trim().min(1).max(120),
  baseUrl: z.string().url().max(2_000).optional(), apiStyle: z.nativeEnum(AiApiStyle).optional(),
});
const smtpConnectionSchema = z.object({
  preset: z.nativeEnum(SmtpPreset), email: z.string().email(), password: z.string().min(1).max(500),
  fromName: z.string().trim().min(1).max(100), host: z.string().trim().max(253).optional(),
  port: z.number().int().min(1).max(65_535).optional(), secure: z.boolean().optional(),
});
const profileUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(240), mimeType: z.nativeEnum(ResumeFileType), dataBase64: z.string().min(1),
  consent: z.literal(true),
});
const profilePatchSchema = z.object({
  name: z.string().trim().min(1).max(100), email: z.string().email().optional(),
  resumeText: z.string().trim().min(20).max(100_000), skills: z.array(z.string()).max(100),
  yearsExperience: z.number().min(0).max(70), targetRoles: z.array(z.string()).max(20),
  locations: z.array(z.string()).max(20), summary: z.string().trim().min(1).max(1_500), language: z.enum(['zh', 'en']),
});
const draftSchema = z.object({
  to: z.string().email(), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(20).max(20_000),
  usedResumeFacts: z.array(z.string().trim().min(1).max(300)).max(12),
});

/** Creates the local API without exposing provider or SMTP secrets in responses. */
export function createApi(database: AppDatabase, mailer: Mailer, vault: SessionVault): express.Express {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/dashboard', (_request, response) => response.json(buildDashboard(database, vault)));

  app.post('/api/ai/connect', asyncHandler(async (request, response) => {
    const input = { ...aiConnectionSchema.parse(request.body), sessionId: randomUUID() };
    await new AiProviderClient(input).probeWebSearch();
    vault.setAi(input);
    response.json(buildDashboard(database, vault));
  }));

  app.post('/api/profile', asyncHandler(async (request, response) => {
    const input = profileUploadSchema.parse(request.body);
    const resume = await parseAndStoreResume(input, config.dataDir);
    const profile = await new AiProviderClient(vault.getAi()).analyzeResume(resume.text, resume.storedFileName);
    database.saveProfile(profile);
    response.status(201).json(buildDashboard(database, vault));
  }));

  app.patch('/api/profile', (request, response) => {
    const current = requireProfile(database);
    const patch = profilePatchSchema.parse(request.body);
    database.saveProfile({
      ...current, ...patch, skills: uniqueTerms(patch.skills), targetRoles: uniqueTerms(patch.targetRoles),
      locations: uniqueTerms(patch.locations), resumeFileName: current.resumeFileName,
    });
    response.json(buildDashboard(database, vault));
  });

  app.post('/api/jobs/discover', asyncHandler(async (request, response) => {
    const { query, limit } = z.object({ query: z.string().trim().max(500).default(''), limit: z.number().int().min(1).max(20).default(10) }).parse(request.body);
    const result = await new AiProviderClient(vault.getAi()).discoverJobs(requireProfile(database), query, limit);
    database.replaceJobs(result.jobs);
    response.status(201).json({ ...result, dashboard: buildDashboard(database, vault) });
  }));

  app.post('/api/jobs/demo', (_request, response) => {
    database.replaceJobs(createSampleJobs(requireProfile(database)));
    response.status(201).json(buildDashboard(database, vault));
  });

  app.post('/api/smtp/connect', asyncHandler(async (request, response) => {
    const input = smtpConnectionSchema.parse(request.body);
    await mailer.verify(input);
    vault.setSmtp(input);
    response.json(buildDashboard(database, vault));
  }));

  app.post('/api/jobs/:jobId/confirmation', (request, response) => {
    const { job, profile } = requireJobContext(database, routeParam(request.params.jobId));
    const draft = validateDraft(job, request.body);
    if (database.hasSent(createDedupeKey(job))) throw new Error('该岗位已成功投递，不能重复发送');
    response.json({ token: vault.issueConfirmation(job.id, draft, profile.resumeFileName), expiresInSeconds: 600 });
  });

  app.post('/api/jobs/:jobId/send', asyncHandler(async (request, response) => {
    const { job, profile } = requireJobContext(database, routeParam(request.params.jobId));
    const { token, draft: rawDraft } = z.object({ token: z.string().min(20).max(200), draft: draftSchema }).parse(request.body);
    const draft = validateDraft(job, rawDraft);
    const dedupeKey = createDedupeKey(job);
    if (database.hasSent(dedupeKey)) throw new Error('该岗位已成功投递，不能重复发送');
    vault.consumeConfirmation(token, job.id, draft, profile.resumeFileName);
    await mailer.send(vault.getSmtp(), draft, profile.resumeFileName);
    const delivery = {
      id: randomUUID(), jobId: job.id, dedupeKey, recipient: draft.to, subject: draft.subject,
      status: DeliveryStatus.Sent, detail: '用户逐封确认后发送', createdAt: new Date().toISOString(),
    };
    database.addDelivery(delivery);
    response.status(201).json(delivery);
  }));

  app.get('/api/export', (_request, response) => {
    const rows = database.listDeliveries();
    const csv = ['时间,岗位ID,收件人,主题,状态,说明', ...rows.map((row) =>
      [row.createdAt, row.jobId, row.recipient, row.subject, row.status, row.detail].map(csvCell).join(','))].join('\n');
    response.type('text/csv').attachment('application-history.csv').send(`\ufeff${csv}`);
  });

  app.delete('/api/data', (_request, response) => {
    vault.clear();
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

function buildDashboard(database: AppDatabase, vault: SessionVault): DashboardData {
  return { profile: database.getProfile(), jobs: database.listJobs(), deliveries: database.listDeliveries(), ai: vault.getAiStatus(), smtp: vault.getSmtpStatus() };
}

function requireProfile(database: AppDatabase): CandidateProfile {
  const profile = database.getProfile();
  if (!profile) throw new Error('请先上传并分析简历');
  return profile;
}

function requireJobContext(database: AppDatabase, jobId: string) {
  const profile = requireProfile(database);
  const job = database.findJob(jobId);
  if (!job) throw new Error('岗位不存在');
  if (!job.eligible || !job.applyEmail || !job.emailSourceUrl) throw new Error('该岗位缺少可验证的公开招聘邮箱');
  return { profile, job };
}

function validateDraft(job: DiscoveredJob, value: unknown): EmailDraft {
  const draft = draftSchema.parse(value);
  if (draft.to.toLowerCase() !== job.applyEmail?.toLowerCase()) throw new Error('收件人必须是岗位公开的申请邮箱');
  return draft;
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

function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function asyncHandler(handler: (request: Request, response: Response) => Promise<unknown>) {
  return (request: Request, response: Response, next: express.NextFunction) => void handler(request, response).catch(next);
}
