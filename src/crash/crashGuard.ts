export interface CrashContextProvider {
  getStateSnapshot: () => Record<string, unknown>;
  onPauseLoop?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
}

interface CrashRecord {
  timestamp: string;
  source: string;
  name: string;
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  viewport: string;
  gameState: Record<string, unknown>;
}

class CrashGuardManager {
  private installed = false;
  private provider: CrashContextProvider | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private lastRecord: CrashRecord | null = null;
  private crashCount = 0;

  public install(provider: CrashContextProvider): void {
    this.provider = provider;
    if (this.installed) return;
    this.installed = true;

    window.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault();
      const err = event.error instanceof Error
        ? event.error
        : new Error(event.message || 'Unknown runtime error');
      this.report(err, `window.error (${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0})`);
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const reason = event.reason;
      const err = reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
      this.report(err, 'unhandledrejection');
    });
  }

  public report(error: unknown, source = 'runtime'): void {
    this.crashCount += 1;
    try {
      this.provider?.onPauseLoop?.();
    } catch {
      // ignore secondary errors during pause
    }

    const errObj = error instanceof Error ? error : new Error(String(error));
    let snapshot: Record<string, unknown> = { note: 'Unavailable' };
    try {
      if (this.provider) {
        snapshot = this.provider.getStateSnapshot();
      }
    } catch (snapErr) {
      snapshot = { snapshotError: String(snapErr) };
    }

    const record: CrashRecord = {
      timestamp: new Date().toISOString(),
      source,
      name: errObj.name || 'Error',
      message: errObj.message || 'No error message provided',
      stack: errObj.stack || '(No stack trace available)',
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight} (dpr=${window.devicePixelRatio || 1})`,
      gameState: snapshot
    };

    this.lastRecord = record;
    // Also log to console for DevTools inspection
    console.error('[CrashGuard Captured]', record);
    this.renderOverlay(record);
  }

  private renderOverlay(record: CrashRecord): void {
    if (!this.overlayEl) {
      const el = document.createElement('div');
      el.id = 'crash-guard-overlay';
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-modal', 'true');
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        background: 'rgba(8, 10, 14, 0.94)',
        color: '#f2f4f8',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        backdropFilter: 'blur(6px)'
      });
      document.body.appendChild(el);
      this.overlayEl = el;
    }

    const reportText = JSON.stringify(record, null, 2);
    const escapedMsg = this.escapeHtml(`${record.name}: ${record.message}`);
    const escapedStack = this.escapeHtml(record.stack);
    const escapedState = this.escapeHtml(JSON.stringify(record.gameState, null, 2));

    this.overlayEl.innerHTML = `
      <div style="
        width: min(760px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: #141720;
        border: 2px solid #e11d48;
        border-radius: 12px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.75);
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          <div>
            <div style="font-size:12px;letter-spacing:0.12em;color:#fb7185;font-weight:700;">
              CRASH GUARD · 安全防崩溃拦截 (#${this.crashCount})
            </div>
            <h2 style="margin:4px 0 0;font-size:20px;color:#fff;font-family:system-ui,sans-serif;">
              游戏遇到异常，已阻止页面退出以便排查
            </h2>
          </div>
          <span style="font-size:12px;color:#94a3b8;">${this.escapeHtml(record.timestamp)}</span>
        </div>

        <div style="background:#1f1218;border:1px solid #881337;border-radius:8px;padding:12px;margin-bottom:12px;">
          <div style="font-size:11px;color:#fda4af;margin-bottom:4px;">来源：${this.escapeHtml(record.source)}</div>
          <div style="font-size:14px;color:#ffe4e6;font-weight:700;word-break:break-word;">${escapedMsg}</div>
        </div>

        <details open style="margin-bottom:12px;">
          <summary style="cursor:pointer;font-size:13px;color:#cbd5e1;margin-bottom:6px;user-select:none;">
            错误堆栈 (Stack Trace)
          </summary>
          <pre style="
            margin:0;
            padding:10px;
            background:#0b0d12;
            border:1px solid #293040;
            border-radius:8px;
            font-size:12px;
            line-height:1.45;
            color:#e2e8f0;
            max-height:190px;
            overflow:auto;
            white-space:pre-wrap;
            word-break:break-word;
          ">${escapedStack}</pre>
        </details>

        <details style="margin-bottom:16px;">
          <summary style="cursor:pointer;font-size:13px;color:#cbd5e1;margin-bottom:6px;user-select:none;">
            崩溃瞬间状态快照 (Game State & Environment)
          </summary>
          <pre style="
            margin:0;
            padding:10px;
            background:#0b0d12;
            border:1px solid #293040;
            border-radius:8px;
            font-size:12px;
            line-height:1.4;
            color:#93c5fd;
            max-height:170px;
            overflow:auto;
            white-space:pre-wrap;
            word-break:break-word;
          ">${escapedState}</pre>
        </details>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="cg-copy" type="button" style="
            background:#2563eb;color:#fff;border:none;border-radius:8px;
            padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;
          ">复制完整错误报告</button>
          <button id="cg-resume" type="button" style="
            background:#334155;color:#f8fafc;border:1px solid #475569;border-radius:8px;
            padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;
          ">尝试恢复继续</button>
          <button id="cg-restart" type="button" style="
            background:#e11d48;color:#fff;border:none;border-radius:8px;
            padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;
          ">安全重启对局</button>
        </div>
        <div id="cg-status" style="margin-top:8px;font-size:12px;color:#86efac;min-height:16px;"></div>
      </div>
    `;

    this.overlayEl.style.display = 'flex';

    const copyBtn = this.overlayEl.querySelector('#cg-copy') as HTMLButtonElement | null;
    const resumeBtn = this.overlayEl.querySelector('#cg-resume') as HTMLButtonElement | null;
    const restartBtn = this.overlayEl.querySelector('#cg-restart') as HTMLButtonElement | null;
    const statusEl = this.overlayEl.querySelector('#cg-status') as HTMLDivElement | null;

    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(reportText);
        if (statusEl) statusEl.textContent = '✓ 已复制完整 JSON 错误报告到剪贴板';
      } catch {
        const ta = document.createElement('textarea');
        ta.value = reportText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        if (statusEl) statusEl.textContent = '✓ 已复制到剪贴板（兼容模式）';
      }
    });

    resumeBtn?.addEventListener('click', () => {
      this.hide();
      try {
        this.provider?.onResume?.();
      } catch (err) {
        this.report(err, 'crashGuard.resume');
      }
    });

    restartBtn?.addEventListener('click', () => {
      this.hide();
      try {
        if (this.provider?.onRestart) {
          this.provider.onRestart();
        } else {
          window.location.reload();
        }
      } catch (err) {
        this.report(err, 'crashGuard.restart');
      }
    });
  }

  public hide(): void {
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
  }

  public getLastRecord(): CrashRecord | null {
    return this.lastRecord;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const CrashGuard = new CrashGuardManager();
