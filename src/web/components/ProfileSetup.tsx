import { useState, type FormEvent } from 'react';
import { RemotePreference } from '../../shared/types';

interface Props {
  busy: boolean;
  onSubmit: (payload: unknown) => Promise<void>;
}

export function ProfileSetup({ busy, onSubmit }: Props) {
  const [file, setFile] = useState<File>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState('');
  const [skills, setSkills] = useState('');
  const [locations, setLocations] = useState('');
  const [years, setYears] = useState(0);
  const [remote, setRemote] = useState(RemotePreference.Any);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) throw new Error('请选择简历文件');
    const dataBase64 = await toBase64(file);
    await onSubmit({
      name, email, fileName: file.name, mimeType: file.type || mimeFromName(file.name), dataBase64,
      skills: split(skills), yearsExperience: years, targetRoles: split(roles), locations: split(locations),
      remotePreference: remote, language: 'zh',
    });
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-copy">
        <span className="eyebrow">LOCAL-FIRST CAREER TOOL</span>
        <h1>把求职从<br /><em>重复劳动</em>里解放出来。</h1>
        <p>在你的电脑上读取简历、解释每个匹配分数，并且只在你打开总开关后发送申请。</p>
        <div className="trust-note"><span>01</span> 简历不上传到第三方岗位源</div>
        <div className="trust-note"><span>02</span> 每封邮件都有去重与限额</div>
      </section>
      <form className="profile-card" onSubmit={(event) => void submit(event)}>
        <div className="step-label">建立你的投递档案 <strong>1 / 2</strong></div>
        <label>你的名字<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="用于邮件落款" /></label>
        <label>发件邮箱<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        <label className="file-drop">
          <input required type="file" accept=".pdf,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0])} />
          <b>{file ? file.name : '拖入或选择简历'}</b><span>PDF / DOCX / TXT，最大 5 MB</span>
        </label>
        <div className="field-grid">
          <label>目标岗位<input required value={roles} onChange={(event) => setRoles(event.target.value)} placeholder="前端工程师, AI 产品" /></label>
          <label>经验年限<input type="number" min="0" max="70" value={years} onChange={(event) => setYears(Number(event.target.value))} /></label>
        </div>
        <label>核心技能（可留空自动提取）<input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="React, TypeScript, Python" /></label>
        <div className="field-grid">
          <label>意向地点<input value={locations} onChange={(event) => setLocations(event.target.value)} placeholder="上海, 杭州" /></label>
          <label>工作方式<select value={remote} onChange={(event) => setRemote(event.target.value as RemotePreference)}><option value="any">不限</option><option value="remote">远程</option><option value="onsite">现场</option></select></label>
        </div>
        <button className="primary wide" disabled={busy}>{busy ? '正在读取简历…' : '进入投递舱 →'}</button>
      </form>
    </main>
  );
}

function split(value: string): string[] {
  return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
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
