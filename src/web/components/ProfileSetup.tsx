import { useState, type FormEvent } from 'react';
import type { AiConnectionInput } from '../../shared/types';
import { AiApiStyle, AiProviderKind } from '../../shared/types';

interface Props {
  aiConnected: boolean;
  busy: boolean;
  onConnect: (payload: AiConnectionInput) => Promise<void>;
  onSubmit: (payload: unknown) => Promise<void>;
}

export function ProfileSetup({ aiConnected, busy, onConnect, onSubmit }: Props) {
  const [kind, setKind] = useState(AiProviderKind.OpenAI);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-5-mini');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiStyle, setApiStyle] = useState(AiApiStyle.Responses);
  const [file, setFile] = useState<File>();
  const [consent, setConsent] = useState(false);

  function changeKind(next: AiProviderKind) {
    setKind(next);
    if (next === AiProviderKind.OpenAI) { setModel('gpt-5-mini'); setApiStyle(AiApiStyle.Responses); }
    if (next === AiProviderKind.Qwen) { setModel('qwen-plus'); setApiStyle(AiApiStyle.QwenChat); }
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    await onConnect({ kind, apiKey, model, ...(kind === AiProviderKind.Custom ? { baseUrl, apiStyle } : {}) });
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) throw new Error('请选择简历文件');
    if (!consent) throw new Error('请先确认 AI 简历分析授权');
    await onSubmit({ fileName: file.name, mimeType: file.type || mimeFromName(file.name), dataBase64: await toBase64(file), consent: true });
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-copy">
        <span className="eyebrow">AI-ASSISTED, HUMAN-CONFIRMED</span>
        <h1>让 AI 找到机会，<br />让你决定<em>每一次投递</em>。</h1>
        <p>联网搜索真实岗位，核验公开招聘邮箱，生成有事实依据的邮件草稿。</p>
        <div className="trust-note"><span>01</span> API Key 和邮箱密码只存在服务内存</div>
        <div className="trust-note"><span>02</span> 没有逐封确认，不会发送邮件</div>
      </section>
      {!aiConnected ? (
        <form className="profile-card" onSubmit={(event) => void connect(event)}>
          <div className="step-label">连接 AI Provider <strong>1 / 2</strong></div>
          <label>Provider<select value={kind} onChange={(event) => changeKind(event.target.value as AiProviderKind)}><option value="openai">OpenAI</option><option value="qwen">阿里云百炼 / Qwen</option><option value="custom">OpenAI-compatible</option></select></label>
          <label>模型<input required value={model} onChange={(event) => setModel(event.target.value)} /></label>
          {kind === AiProviderKind.Custom && <><label>HTTPS Base URL<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label><label>API 样式<select value={apiStyle} onChange={(event) => setApiStyle(event.target.value as AiApiStyle)}><option value="responses">Responses API</option><option value="qwen_chat">Chat Completions + Search</option></select></label></>}
          <label>API Key<input required type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" /></label>
          <p className="form-note">连接时会发起一次联网能力探测。Key 不会写入数据库或浏览器存储。</p>
          <button className="primary wide" disabled={busy}>{busy ? '正在探测…' : '验证并继续 →'}</button>
        </form>
      ) : (
        <form className="profile-card" onSubmit={(event) => void upload(event)}>
          <div className="step-label">上传简历 <strong>2 / 2</strong></div>
          <label className="file-drop"><input required type="file" accept=".pdf,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0])} /><b>{file ? file.name : '拖入或选择简历'}</b><span>PDF / DOCX / TXT，最大 5 MB</span></label>
          <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我同意将简历正文发送给已选的 AI Provider，用于提取求职档案和搜索岗位。</span></label>
          <p className="form-note">简历副本保存在本机 `.data/`；它不会发给岗位网站。</p>
          <button className="primary wide" disabled={busy || !consent}>{busy ? 'AI 正在读取…' : '分析简历并进入工作台 →'}</button>
        </form>
      )}
    </main>
  );
}

function mimeFromName(name: string): string {
  if (name.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (name.toLowerCase().endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'text/plain';
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('读取简历失败'));
    reader.readAsDataURL(file);
  });
}
