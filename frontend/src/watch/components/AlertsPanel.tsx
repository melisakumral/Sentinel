import { useState, type FormEvent } from 'react';
import { toStroops, fromStroops } from '../../lib/stroops';
import { newRuleId, type AlertRule, type Comparator, type FiredAlert } from '../lib/alertRules';
import { relativeTime } from '../lib/format';

interface Props {
  contractId: string;
  rules: AlertRule[];
  firedAlerts: FiredAlert[];
  notifPermission: NotificationPermission | 'unsupported';
  onRequestNotifPermission: () => void;
  onAdd: (rule: AlertRule) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  now: number;
}

const COMPARATORS: Comparator[] = ['>', '>=', '<', '<='];

function ruleSummary(rule: AlertRule): string {
  const scope = rule.eventKind === 'any' ? 'any event' : `"${rule.eventKind}" events`;
  if (rule.kind === 'threshold') {
    return `Alert when ${scope} moves ${rule.comparator} ${fromStroops(rule.thresholdStroops)} XLM`;
  }
  return `Alert when ${rule.count}+ ${scope} happen within ${rule.windowSeconds}s`;
}

export default function AlertsPanel({
  contractId,
  rules,
  firedAlerts,
  notifPermission,
  onRequestNotifPermission,
  onAdd,
  onToggle,
  onDelete,
  now,
}: Props) {
  const [kind, setKind] = useState<'threshold' | 'frequency'>('threshold');
  const [label, setLabel] = useState('');
  const [eventKind, setEventKind] = useState('any');
  const [comparator, setComparator] = useState<Comparator>('>');
  const [thresholdXlm, setThresholdXlm] = useState('100');
  const [count, setCount] = useState('5');
  const [windowSeconds, setWindowSeconds] = useState('60');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedLabel = label.trim() || (kind === 'threshold' ? 'Threshold alert' : 'Frequency alert');
    const trimmedEventKind = eventKind.trim() || 'any';

    if (kind === 'threshold') {
      const xlm = Number(thresholdXlm);
      if (!Number.isFinite(xlm) || xlm <= 0) {
        setFormError('Enter a positive XLM threshold.');
        return;
      }
      onAdd({
        id: newRuleId(),
        contractId,
        kind: 'threshold',
        label: trimmedLabel,
        eventKind: trimmedEventKind,
        comparator,
        thresholdStroops: toStroops(xlm),
        enabled: true,
      });
    } else {
      const n = Number(count);
      const secs = Number(windowSeconds);
      if (!Number.isInteger(n) || n <= 0) {
        setFormError('Enter a positive whole-number event count.');
        return;
      }
      if (!Number.isFinite(secs) || secs <= 0) {
        setFormError('Enter a positive time window in seconds.');
        return;
      }
      onAdd({
        id: newRuleId(),
        contractId,
        kind: 'frequency',
        label: trimmedLabel,
        eventKind: trimmedEventKind,
        count: n,
        windowSeconds: secs,
        enabled: true,
      });
    }
    setLabel('');
  };

  return (
    <section className="watch-panel">
      <div className="watch-panel-head">
        <h2>Alerts</h2>
        <div className="watch-panel-meta">
          <span>{rules.filter((r) => r.enabled).length} active rule{rules.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {notifPermission !== 'unsupported' && notifPermission !== 'granted' && (
        <div className="watch-banner">
          Browser notifications are off — alerts still show as in-app toasts, but you won't get a
          system notification while this tab is in the background.
          <button className="watch-btn watch-btn--ghost watch-banner-btn" onClick={onRequestNotifPermission}>
            Enable notifications
          </button>
        </div>
      )}

      <form className="watch-rule-form" onSubmit={submit}>
        <div className="watch-form-row">
          <label>
            Rule type
            <select value={kind} onChange={(e) => setKind(e.target.value as 'threshold' | 'frequency')}>
              <option value="threshold">Threshold — value crosses a limit</option>
              <option value="frequency">Frequency — too many events, too fast</option>
            </select>
          </label>
          <label>
            Event kind
            <input
              value={eventKind}
              onChange={(e) => setEventKind(e.target.value)}
              placeholder="any / deposit / claim / refund / ..."
            />
          </label>
        </div>

        {kind === 'threshold' ? (
          <div className="watch-form-row">
            <label>
              Comparator
              <select value={comparator} onChange={(e) => setComparator(e.target.value as Comparator)}>
                {COMPARATORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Threshold (XLM)
              <input type="number" min="0" step="any" value={thresholdXlm} onChange={(e) => setThresholdXlm(e.target.value)} />
            </label>
          </div>
        ) : (
          <div className="watch-form-row">
            <label>
              Event count
              <input type="number" min="1" step="1" value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <label>
              Window (seconds)
              <input type="number" min="1" step="1" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} />
            </label>
          </div>
        )}

        <div className="watch-form-row">
          <label className="watch-form-row--grow">
            Label (optional)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Large withdrawal watch" />
          </label>
          <button type="submit" className="watch-btn watch-btn--primary">
            + Add rule
          </button>
        </div>
        {formError && <div className="watch-form-error">{formError}</div>}
      </form>

      {rules.length === 0 ? (
        <div className="watch-empty">No rules yet for this contract. Add one above to start watching.</div>
      ) : (
        <ul className="watch-rule-list">
          {rules.map((rule) => (
            <li className={`watch-rule-item ${rule.enabled ? '' : 'watch-rule-item--disabled'}`} key={rule.id}>
              <div>
                <div className="watch-rule-label">{rule.label}</div>
                <div className="watch-rule-summary">{ruleSummary(rule)}</div>
              </div>
              <div className="watch-rule-actions">
                <button className="watch-btn watch-btn--ghost" onClick={() => onToggle(rule.id)}>
                  {rule.enabled ? 'Pause' : 'Resume'}
                </button>
                <button className="watch-btn watch-btn--danger" onClick={() => onDelete(rule.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="watch-subheading">Recent alerts</h3>
      {firedAlerts.length === 0 ? (
        <div className="watch-empty watch-empty--tight">Nothing has fired yet.</div>
      ) : (
        <ul className="watch-alert-log">
          {firedAlerts.map((a, i) => (
            <li key={`${a.ruleId}-${a.at}-${i}`}>
              <span className="watch-alert-log-label">{a.label}</span>
              <span className="watch-alert-log-msg">{a.message}</span>
              <span className="watch-alert-log-time">{relativeTime(new Date(a.at).toISOString(), now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
