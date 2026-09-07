export enum ResumeFileType {
  Pdf = 'application/pdf',
  Docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  Text = 'text/plain',
}

export enum DeliveryStatus {
  Sent = 'sent',
  Skipped = 'skipped',
  TemporaryFailure = 'temporary_failure',
  PermanentFailure = 'permanent_failure',
}

export enum AiProviderKind {
  OpenAI = 'openai',
  Qwen = 'qwen',
  Custom = 'custom',
}

export enum AiApiStyle {
  Responses = 'responses',
  QwenChat = 'qwen_chat',
}

export enum SmtpPreset {
  Gmail = 'gmail',
  Outlook = 'outlook',
  QQ = 'qq',
  NetEase = 'netease',
  Custom = 'custom',
}

export interface AiConnectionInput {
  kind: AiProviderKind;
  apiKey: string;
  model: string;
  baseUrl?: string;
  apiStyle?: AiApiStyle;
}

export interface AiConnectionStatus {
  connected: boolean;
  kind?: AiProviderKind;
  model?: string;
}

export interface SmtpConnectionInput {
  preset: SmtpPreset;
  email: string;
  password: string;
  fromName: string;
  host?: string;
  port?: number;
  secure?: boolean;
}

export interface CandidateProfile {
  name: string;
  email?: string;
  resumeFileName: string;
  resumeText: string;
  skills: string[];
  yearsExperience: number;
  targetRoles: string[];
  locations: string[];
  summary: string;
  language: 'zh' | 'en';
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  usedResumeFacts: string[];
}

export interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  remote: boolean;
  publishedAt?: string;
  sourceTitle: string;
  sourceUrl: string;
  applyEmail?: string;
  emailSourceUrl?: string;
  searchedAt: string;
  score: number;
  confidence: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  blockers: string[];
  eligible: boolean;
  draft?: EmailDraft;
}

export interface DeliveryRecord {
  id: string;
  jobId: string;
  dedupeKey: string;
  recipient: string;
  subject: string;
  status: DeliveryStatus;
  detail: string;
  createdAt: string;
}

export interface DashboardData {
  profile?: CandidateProfile;
  jobs: DiscoveredJob[];
  deliveries: DeliveryRecord[];
  ai: AiConnectionStatus;
  smtp: { connected: boolean; email?: string };
}
