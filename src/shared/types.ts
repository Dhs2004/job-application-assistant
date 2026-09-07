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

export enum RemotePreference {
  Any = 'any',
  Remote = 'remote',
  Onsite = 'onsite',
}

export interface CandidateProfile {
  name: string;
  email: string;
  resumeFileName: string;
  resumeText: string;
  skills: string[];
  yearsExperience: number;
  targetRoles: string[];
  locations: string[];
  remotePreference: RemotePreference;
  minimumSalary?: number;
  language: 'zh' | 'en';
}

export type PublicCandidateProfile = CandidateProfile;

export interface JobRecord {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  remote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  skills: string[];
  requiredSkills: string[];
  applyEmail?: string;
  url: string;
  source: string;
  active: boolean;
  importedAt: string;
}

export interface MatchBreakdown {
  requiredSkills: number;
  relatedSkills: number;
  experience: number;
  location: number;
  roleAndSalary: number;
}

export interface JobMatch {
  job: JobRecord;
  score: number;
  eligible: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  blockers: string[];
  breakdown: MatchBreakdown;
}

export interface AutomationSettings {
  enabled: boolean;
  threshold: number;
  dailyLimit: number;
  templateConfirmed: boolean;
  smtpTested: boolean;
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

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface DashboardData {
  profile?: PublicCandidateProfile;
  matches: JobMatch[];
  deliveries: DeliveryRecord[];
  settings: AutomationSettings;
  smtp: { configured: boolean; from?: string };
}
