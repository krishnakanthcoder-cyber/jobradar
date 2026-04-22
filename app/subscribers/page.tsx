'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string, ok: boolean) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ msg, ok });
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const fetchSubscribers = useCallback(async () => {
    try {
      const res = await fetch('/api/subscribers');
      const data = await res.json();
      setSubscribers(data.subscribers ?? []);
    } catch {
      showNotice('Failed to load subscribers.', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [fetchSubscribers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEmail('');
      showNotice(`${email.trim()} added successfully.`, true);
      fetchSubscribers();
    } catch (err) {
      showNotice((err as Error).message, false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (target: string) => {
    setRemovingEmail(target);
    try {
      const res = await fetch('/api/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      showNotice(`${target} removed.`, true);
      fetchSubscribers();
    } catch (err) {
      showNotice((err as Error).message, false);
    } finally {
      setRemovingEmail(null);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .sub-shell {
          min-height: 100vh;
          padding: 32px 20px 72px;
          background:
            radial-gradient(circle at top left, rgba(210, 109, 61, 0.10), transparent 28%),
            linear-gradient(180deg, #fffdf9 0%, #f7f5f1 40%, #f3f1ed 100%);
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .sub-inner {
          max-width: 680px;
          margin: 0 auto;
        }

        .sub-header {
          margin-bottom: 28px;
        }

        .sub-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(210, 109, 61, 0.18);
          background: rgba(210, 109, 61, 0.08);
          color: #8f4521;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .sub-title {
          margin: 0 0 8px;
          font-size: clamp(1.6rem, 4vw, 2.4rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #18181b;
          line-height: 1.1;
        }

        .sub-desc {
          margin: 0;
          color: #57534e;
          font-size: 15px;
          line-height: 1.65;
        }

        .sub-card {
          border: 1px solid rgba(24, 24, 27, 0.08);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(8px);
          box-shadow: 0 10px 30px rgba(24, 24, 27, 0.05);
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 16px;
        }

        .sub-card-title {
          margin: 0 0 18px;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #18181b;
        }

        .sub-form {
          display: flex;
          gap: 10px;
        }

        .sub-input {
          flex: 1;
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(24, 24, 27, 0.12);
          background: #fff;
          padding: 0 16px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #18181b;
          outline: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }

        .sub-input:focus {
          border-color: rgba(210, 109, 61, 0.4);
          box-shadow: 0 0 0 4px rgba(210, 109, 61, 0.08);
        }

        .sub-input::placeholder {
          color: #a8a29e;
        }

        .sub-submit {
          min-height: 48px;
          padding: 0 20px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #c95b26, #d97c4d);
          color: #fff;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 8px 20px rgba(201, 91, 38, 0.22);
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .sub-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(201, 91, 38, 0.28);
        }

        .sub-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .sub-spinner {
          width: 13px;
          height: 13px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          animation: sub-spin 0.7s linear infinite;
        }

        @keyframes sub-spin {
          to { transform: rotate(360deg); }
        }

        .sub-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
          animation: sub-fade-in 0.2s ease;
        }

        @keyframes sub-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sub-notice.ok {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.18);
          color: #166534;
        }

        .sub-notice.err {
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.18);
          color: #9f1239;
        }

        .sub-list {
          display: grid;
          gap: 10px;
        }

        .sub-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(24, 24, 27, 0.07);
          background: #fafaf9;
          animation: sub-fade-in 0.2s ease both;
        }

        .sub-row-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .sub-avatar {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(210, 109, 61, 0.12), rgba(210, 109, 61, 0.04));
          border: 1px solid rgba(210, 109, 61, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c95b26;
          font-size: 13px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .sub-email {
          font-size: 14px;
          font-weight: 600;
          color: #18181b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sub-remove {
          flex-shrink: 0;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid rgba(244, 63, 94, 0.15);
          background: rgba(244, 63, 94, 0.06);
          color: #be123c;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.16s ease, transform 0.16s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .sub-remove:hover:not(:disabled) {
          background: rgba(244, 63, 94, 0.12);
          transform: translateY(-1px);
        }

        .sub-remove:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sub-empty {
          text-align: center;
          padding: 36px 20px;
          color: #78716c;
          font-size: 14px;
          font-weight: 500;
        }

        .sub-count-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(24, 24, 27, 0.06);
          color: #57534e;
          font-size: 12px;
          font-weight: 700;
          margin-left: 8px;
        }

        .skeleton-row {
          height: 62px;
          border-radius: 14px;
          background: linear-gradient(
            90deg,
            rgba(231, 229, 228, 0.9) 25%,
            rgba(245, 245, 244, 0.95) 50%,
            rgba(231, 229, 228, 0.9) 75%
          );
          background-size: 600px 100%;
          animation: sub-shimmer 1.3s infinite linear;
        }

        @keyframes sub-shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }

        @media (max-width: 480px) {
          .sub-form { flex-direction: column; }
          .sub-submit { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="sub-shell">
        <div className="sub-inner">
          <div className="sub-header">
            <div className="sub-kicker">Email alerts</div>
            <h1 className="sub-title">Subscribers</h1>
            <p className="sub-desc">
              Anyone on this list gets an email the moment new engineering roles are detected
              in a scan.
            </p>
          </div>

          {notice && (
            <div className={`sub-notice ${notice.ok ? 'ok' : 'err'}`}>
              {notice.ok ? '✓' : '✕'} {notice.msg}
            </div>
          )}

          <div className="sub-card">
            <p className="sub-card-title">Add subscriber</p>
            <form className="sub-form" onSubmit={handleAdd}>
              <input
                className="sub-input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
              <button className="sub-submit" type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="sub-spinner" />
                    Adding…
                  </>
                ) : (
                  'Add subscriber'
                )}
              </button>
            </form>
          </div>

          <div className="sub-card">
            <p className="sub-card-title">
              Active subscribers
              {!loading && (
                <span className="sub-count-chip">{subscribers.length}</span>
              )}
            </p>

            {loading ? (
              <div className="sub-list">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-row" style={{ opacity: 1 - (n - 1) * 0.15 }} />
                ))}
              </div>
            ) : subscribers.length === 0 ? (
              <div className="sub-empty">No subscribers yet — add one above.</div>
            ) : (
              <div className="sub-list">
                {subscribers.map((sub, i) => (
                  <div
                    key={sub}
                    className="sub-row"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="sub-row-left">
                      <div className="sub-avatar">
                        {sub[0].toUpperCase()}
                      </div>
                      <span className="sub-email">{sub}</span>
                    </div>
                    <button
                      className="sub-remove"
                      onClick={() => handleRemove(sub)}
                      disabled={removingEmail === sub}
                    >
                      {removingEmail === sub ? (
                        <>
                          <span className="sub-spinner" style={{ borderColor: 'rgba(190,18,60,0.3)', borderTopColor: '#be123c' }} />
                          Removing…
                        </>
                      ) : (
                        'Remove'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
