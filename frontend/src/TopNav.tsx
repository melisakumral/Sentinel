import { useLanguage } from './i18n/useLanguage';
import { SentinelLogo } from './Logo';
import { IconRadar } from './icons';
import './TopNav.css';

interface Props {
  active: 'home' | 'watch';
}

// The single persistent navigation surface shared by ConnectGate, the
// Dashboard, and Sentinel Watch — previously each screen had its own
// ad-hoc way (or none) to get to the others, which read as inconsistent.
// Also hosts the EN/TR language toggle so it's reachable from anywhere.
export default function TopNav({ active }: Props) {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="tn-root">
      <a href="#/" className="tn-brand">
        <span className="tn-brand-mark">
          <SentinelLogo size={16} />
        </span>
        <span className="tn-brand-name">{t('brandName')}</span>
      </a>

      <nav className="tn-links">
        <a href="#/" className={`tn-link ${active === 'home' ? 'tn-link--active' : ''}`}>
          {t('navOverview')}
        </a>
        <a href="#/watch" className={`tn-link ${active === 'watch' ? 'tn-link--active' : ''}`}>
          <IconRadar size={13} />
          {t('navWatch')}
        </a>
      </nav>

      <div className="tn-spacer" />

      <div className="tn-lang" role="group" aria-label={t('langToggleLabel')}>
        <button
          type="button"
          className={`tn-lang-btn ${lang === 'en' ? 'tn-lang-btn--active' : ''}`}
          onClick={() => setLang('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={`tn-lang-btn ${lang === 'tr' ? 'tn-lang-btn--active' : ''}`}
          onClick={() => setLang('tr')}
        >
          TR
        </button>
      </div>
    </header>
  );
}
