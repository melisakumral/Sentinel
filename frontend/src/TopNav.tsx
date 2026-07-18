import { useLanguage } from './i18n/useLanguage';
import { SentinelLogo } from './Logo';
import { IconRadar, IconHome, IconCompass, IconUser } from './icons';
import ProfileMenu from './ProfileMenu';
import './TopNav.css';

interface ProfileSlot {
  pubKey: string;
  isOwner?: boolean;
  onDisconnect: () => void;
}

interface Props {
  active: 'home' | 'watch' | 'explore' | 'profile';
  profile?: ProfileSlot;
}

// The single persistent navigation surface shared by ConnectGate, Dashboard,
// Explore, Profile, and Sentinel Watch. Visitor state (no `profile` prop):
// Home + Explore + Watch links only. Connected state (`profile` supplied):
// adds the Profile link plus the account area on the right, next to the
// EN/TR toggle — so the wallet/account slot always lives in the same place.
export default function TopNav({ active, profile }: Props) {
  const { lang, setLang, t } = useLanguage();

  return (
    <>
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
        <a href="#/explore" className={`tn-link ${active === 'explore' ? 'tn-link--active' : ''}`}>
          {t('navExplore')}
        </a>
        <a href="#/watch" className={`tn-link ${active === 'watch' ? 'tn-link--active' : ''}`}>
          <IconRadar size={13} />
          {t('navWatch')}
        </a>
        {profile && (
          <a href="#/profile" className={`tn-link ${active === 'profile' ? 'tn-link--active' : ''}`}>
            {t('navProfile')}
          </a>
        )}
      </nav>

      <div className="tn-spacer" />

      {profile && (
        <div className="tn-profile-slot">
          <ProfileMenu pubKey={profile.pubKey} isOwner={profile.isOwner} onDisconnect={profile.onDisconnect} align="right" />
        </div>
      )}

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

      {/* Mobile-only bottom tab bar (see the max-width: 640px rules in
          TopNav.css) — replaces the top nav links as the primary way to move
          between screens on small viewports, where a horizontal top bar gets
          cramped and hard to tap accurately. Rendered as a sibling of
          <header>, not a child: .tn-root has backdrop-filter, which (like
          `filter`/`transform`) makes an element a containing block for its
          fixed-position descendants — nested here, "position: fixed; bottom:
          0" would resolve against the 56px-tall header instead of the
          viewport, pinning it to the top of the page instead of the bottom. */}
      <nav className="tn-mobile-tabs" aria-label={t('navOverview')}>
        <a href="#/" className={`tn-mtab ${active === 'home' ? 'tn-mtab--active' : ''}`}>
          <IconHome size={19} />
          <span>{t('navOverview')}</span>
        </a>
        <a href="#/explore" className={`tn-mtab ${active === 'explore' ? 'tn-mtab--active' : ''}`}>
          <IconCompass size={19} />
          <span>{t('navExplore')}</span>
        </a>
        <a href="#/watch" className={`tn-mtab ${active === 'watch' ? 'tn-mtab--active' : ''}`}>
          <IconRadar size={19} />
          <span>{t('navWatch')}</span>
        </a>
        {profile && (
          <a href="#/profile" className={`tn-mtab ${active === 'profile' ? 'tn-mtab--active' : ''}`}>
            <IconUser size={19} />
            <span>{t('navProfile')}</span>
          </a>
        )}
      </nav>
    </>
  );
}
