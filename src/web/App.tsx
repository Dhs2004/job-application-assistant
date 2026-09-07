import { useEffect, useMemo, useState } from 'react';
import type { DashboardData, EmailDraft, SmtpConnectionInput } from '../shared/types';
import { SmtpPreset } from '../shared/types';
import { api } from './api';
import { JobCard } from './components/JobCard';
import { MatchDetail } from './components/MatchDetail';
import { ProfileSetup } from './components/ProfileSetup';

export default function App() {
  const [data, setData] = useState<DashboardData>();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<EmailDraft>();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [showSmtp, setShowSmtp] = useState(false);

  useEffect(() => { void run('加载数据', async () => setData(await api.dashboard())); }, []);
  const selected = useMemo(() => data?.jobs.find((job) => job.id === selectedId), [data, selectedId]);
  const sentIds = useMemo(() => new Set(data?.deliveries.filter((item) => item.status === 'sent').map((item) => item.jobId)), [data]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); }
    finally { setBusy(''); }
  }

  function chooseJob(jobId: string) {
    const job = data?.jobs.find((item) => item.id === jobId);
    setSelectedId(jobId);
    setDraft(job?.draft ? { ...job.draft } : undefined);
  }

  if (!data) return <div className="loading-screen"><span>投递舱</span><i /></div>;
  if (!data.profile || !data.ai.connected) {
    return <><ProfileSetup aiConnected={data.ai.connected} busy={Boolean(busy)} onConnect={(payload) => run('验证 AI', async () => setData(await api.connectAi(payload)))} onSubmit={(payload) => run('分析简历', async () => setData(await api.uploadProfile(payload)))} /><Toast error={error} notice={notice} /></>;
  }

  const sendable = data.jobs.filter((job) => job.eligible).length;
  const sent = data.deliveries.filter((item) => item.status === 'sent').length;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span>投</span><b>投递舱</b><small>AI SEARCH · HUMAN CONFIRMATION</small></div>
        <div className="top-actions">
          <button className="text-button" onClick={() => setShowHistory(!showHistory)}>{showHistory ? '返回岗位' : `投递记录 ${data.deliveries.length}`}</button>
          <button className="avatar" onClick={() => setShowResume(true)} title="查看简历">{data.profile.name.slice(0, 1)}</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-rail">
          <div className="rail-section">
            <span className="eyebrow">AI SEARCH</span>
            <div className="status-dot ready"><i />{data.ai.kind} · {data.ai.model}</div>
            <label>搜索补充条件<textarea className="query-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：上海或远程，创业团队优先" /></label>
            <button className="primary wide" disabled={Boolean(busy)} onClick={() => void run('AI 搜索岗位', async () => {
              const result = await api.discover(query); setData(result.dashboard); setSelectedId(undefined); setDraft(undefined);
              setNotice(`找到 ${result.jobs.length} 个有来源的岗位，过滤 ${result.filtered} 个无效结果`);
            })}>{busy === 'AI 搜索岗位' ? '正在检索和核验…' : '寻找适合我的岗位'}</button>
            <button className="outline wide" disabled={Boolean(busy)} onClick={() => void run('载入演示', async () => { setData(await api.loadDemo()); setNotice('已载入不会代表真实招聘的演示岗位'); })}>预览演示结果</button>
          </div>

          <div className="rail-section connection">
            <span className="eyebrow">MAIL CONNECTION</span>
            <div className={`status-dot ${data.smtp.connected ? 'ready' : ''}`}><i />{data.smtp.connected ? 'SMTP 已验证' : '等待邮箱授权'}</div>
            {data.smtp.email && <small>{data.smtp.email}</small>}
            <button className="outline wide" onClick={() => setShowSmtp(true)}>{data.smtp.connected ? '更换发件邮箱' : '连接发件邮箱'}</button>
          </div>

          <div className="rail-section safety-card"><span className="eyebrow">DELIVERY RULE</span><b>一次确认，一封邮件</b><p>确认 token 与当前收件人、主题、正文和简历绑定，10 分钟后失效。</p></div>
          <div className="rail-footer"><a href="/api/export">导出记录</a><button onClick={() => void clearAll()}>清除本地数据</button></div>
        </aside>

        {showHistory ? <History data={data} /> : (
          <main className="job-stage">
            <section className="stage-head"><div><span className="eyebrow">SOURCED SHORTLIST</span><h1>{data.jobs.length ? `${sendable} 个岗位可以进入确认` : '等待第一次 AI 搜索'}</h1></div><div className="metric"><b>{data.jobs.length}</b><span>有来源</span></div><div className="metric accent"><b>{sent}</b><span>已投递</span></div></section>
            <section className="job-list">
              {data.jobs.length === 0 ? <EmptyJobs onLoad={() => void run('载入演示', async () => setData(await api.loadDemo()))} /> : data.jobs.map((job) => <JobCard key={job.id} job={job} active={selectedId === job.id} sent={sentIds.has(job.id)} onClick={() => chooseJob(job.id)} />)}
            </section>
          </main>
        )}
        {!showHistory && <MatchDetail job={selected} draft={draft} busy={busy === '确认投递'} smtpConnected={data.smtp.connected} sent={selected ? sentIds.has(selected.id) : false} onDraftChange={setDraft} onSend={() => run('确认投递', async () => {
          if (!selected || !draft) return;
          if (!window.confirm(`确定向 ${draft.to} 发送这一封申请邮件吗？`)) return;
          const { token } = await api.confirm(selected.id, draft);
          await api.send(selected.id, token, draft);
          setData(await api.dashboard()); setNotice('申请邮件已发送');
        })} />}
      </div>
      {showResume && <ResumeEditor data={data} busy={Boolean(busy)} onClose={() => setShowResume(false)} onSave={(payload) => run('保存简历', async () => { setData(await api.updateProfile(payload)); setShowResume(false); })} />}
      {showSmtp && <SmtpDialog busy={Boolean(busy)} onClose={() => setShowSmtp(false)} onConnect={(payload) => run('验证邮箱', async () => { setData(await api.connectSmtp(payload)); setShowSmtp(false); setNotice('发件邮箱已通过连接测试'); })} />}
      <Toast error={error} notice={notice} />
    </div>
  );

  async function clearAll() {
    if (!window.confirm('确定删除本机简历、岗位、投递记录与当前会话密钥吗？')) return;
    await run('清除数据', async () => { await api.clear(); setData(await api.dashboard()); });
  }
}

function EmptyJobs({ onLoad }: { onLoad: () => void }) { return <div className="empty-jobs"><span>∅</span><h2>还没有岗位进入雷达</h2><p>点击左侧主按钮启动联网搜索，或先用演示数据查看来源核验和逐封确认流程。</p><button className="outline" onClick={onLoad}>预览演示结果</button></div>; }
function Toast({ error, notice }: { error?: string; notice?: string }) { return error || notice ? <div className={`toast ${error ? 'error' : ''}`}>{error || notice}</div> : null; }
function History({ data }: { data: DashboardData }) { return <main className="job-stage history"><div className="stage-head"><div><span className="eyebrow">APPLICATION LOG</span><h1>每一次确认，都有迹可循。</h1></div></div>{data.deliveries.length === 0 ? <p className="history-empty">尚无投递记录。</p> : <table><thead><tr><th>时间</th><th>岗位</th><th>收件人</th><th>状态</th></tr></thead><tbody>{data.deliveries.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{data.jobs.find((job) => job.id === item.jobId)?.title ?? item.jobId}</td><td>{item.recipient.replace(/^(.{2}).*(@.*)$/, '$1***$2')}</td><td><span className={`status ${item.status}`}>{item.status}</span></td></tr>)}</tbody></table>}</main>; }

function ResumeEditor({ data, busy, onClose, onSave }: { data: DashboardData; busy: boolean; onClose: () => void; onSave: (payload: unknown) => Promise<void> }) {
  const profile = data.profile!;
  const [resumeText, setResumeText] = useState(profile.resumeText);
  const [skills, setSkills] = useState(profile.skills.join(', '));
  return <div className="modal-backdrop"><section className="resume-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">CANDIDATE PROFILE</span><h2>校正 AI 提取结果</h2><label>技能<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label><label>简历文本<textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} /></label><button className="primary" disabled={busy} onClick={() => void onSave({ ...profile, resumeText, skills: split(skills) })}>保存校正</button></section></div>;
}

function SmtpDialog({ busy, onClose, onConnect }: { busy: boolean; onClose: () => void; onConnect: (input: SmtpConnectionInput) => Promise<void> }) {
  const [preset, setPreset] = useState(SmtpPreset.QQ);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [fromName, setFromName] = useState('');
  const [host, setHost] = useState(''); const [port, setPort] = useState(587); const [secure, setSecure] = useState(false);
  return <div className="modal-backdrop"><form className="smtp-modal" onSubmit={(event) => { event.preventDefault(); void onConnect({ preset, email, password, fromName, ...(preset === SmtpPreset.Custom ? { host, port, secure } : {}) }); }}><button type="button" className="modal-close" onClick={onClose}>×</button><span className="eyebrow">SESSION-ONLY SMTP</span><h2>连接发件邮箱</h2><label>邮箱服务<select value={preset} onChange={(event) => setPreset(event.target.value as SmtpPreset)}><option value="qq">QQ 邮箱</option><option value="netease">163 邮箱</option><option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="custom">自定义 SMTP</option></select></label><div className="field-grid"><label>发件邮箱<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>发件人名称<input required value={fromName} onChange={(event) => setFromName(event.target.value)} /></label></div>{preset === SmtpPreset.Custom && <div className="field-grid"><label>SMTP Host<input required value={host} onChange={(event) => setHost(event.target.value)} /></label><label>Port<input required type="number" value={port} onChange={(event) => setPort(Number(event.target.value))} /></label><label className="consent-row"><input type="checkbox" checked={secure} onChange={(event) => setSecure(event.target.checked)} /><span>使用 TLS 直连</span></label></div>}<label>应用专用密码 / SMTP Token<input required type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} /></label><p className="form-note">密码只保存在当前 Node 进程内存中，服务重启后需重新输入。</p><button className="primary wide" disabled={busy}>{busy ? '正在测试连接…' : '验证 SMTP 连接'}</button></form></div>;
}

function split(value: string): string[] { return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean); }
