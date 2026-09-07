import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import AdmZip from 'adm-zip';
import { PDFParse } from 'pdf-parse';
import { ResumeFileType } from '../shared/types.js';

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Map([
  [ResumeFileType.Pdf, '.pdf'],
  [ResumeFileType.Docx, '.docx'],
  [ResumeFileType.Text, '.txt'],
]);

export interface ResumeUpload {
  fileName: string;
  mimeType: ResumeFileType;
  dataBase64: string;
}

export async function parseAndStoreResume(upload: ResumeUpload, dataDir: string): Promise<{ text: string; storedFileName: string }> {
  const expectedExtension = ALLOWED_EXTENSIONS.get(upload.mimeType);
  if (!expectedExtension || extname(upload.fileName).toLowerCase() !== expectedExtension) {
    throw new Error('文件扩展名与支持的简历格式不一致');
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(upload.dataBase64)) throw new Error('简历内容不是合法 Base64');
  const buffer = Buffer.from(upload.dataBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_RESUME_BYTES) throw new Error('简历必须大于 0 且不超过 5 MB');
  validateSignature(buffer, upload.mimeType);

  const text = (await extractText(buffer, upload.mimeType)).replace(/\0/g, '').trim();
  if (text.length < 20) throw new Error('未能从简历中解析出足够文本，请改用 TXT 或检查文件');
  const storedFileName = `resume${expectedExtension}`;
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dataDir, storedFileName), buffer, { mode: 0o600 });
  return { text: text.slice(0, 100_000), storedFileName };
}

function validateSignature(buffer: Buffer, mimeType: ResumeFileType): void {
  if (mimeType === ResumeFileType.Pdf && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error('文件内容不是有效 PDF');
  }
  if (mimeType === ResumeFileType.Docx && !buffer.subarray(0, 2).equals(Buffer.from('PK'))) {
    throw new Error('文件内容不是有效 DOCX');
  }
}

async function extractText(buffer: Buffer, mimeType: ResumeFileType): Promise<string> {
  if (mimeType === ResumeFileType.Text) return buffer.toString('utf8');
  if (mimeType === ResumeFileType.Pdf) {
    const parser = new PDFParse({ data: buffer });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  const zip = new AdmZip(buffer);
  const document = zip.getEntry('word/document.xml');
  if (!document) throw new Error('DOCX 缺少 word/document.xml');
  return document.getData().toString('utf8')
    .replace(/<w:tab\/?[^>]*>/g, '\t').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
