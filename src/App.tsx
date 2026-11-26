import React, { useCallback, useEffect, useState } from 'react';
import {
  Instagram,
  Mail,
  Menu,
  Share2,
  X,
  Youtube,
} from 'lucide-react';
import {
  CONTACT_CONFIG,
  DIRECTORY_MEMBERS,
  DirectoryMember,
  EditorialStory,
  EliteModel,
  MEMBERSHIP_TIERS,
  MembershipPlanId,
  MembershipTier,
  MODEL_VALUE_PILLARS,
  SOCIAL_FRAMES,
  SocialFrame,
} from './data/clubData';
import { EditorialPlate } from './components/EditorialPlate';
import { MembershipSection, PaymentProvider } from './components/MembershipSection';
import { ManagementSection } from './components/ManagementSection';
import { MediaProductionSection } from './components/MediaProductionSection';
import { ProNewsPage } from './components/ProNewsPage';
import { DirectoryPage } from './components/DirectoryPage';
import { StripeCheckoutModal } from './components/StripeCheckoutModal';
import { AdminDashboard } from './components/AdminDashboard';
import { OnboardingPage } from './components/OnboardingPage';
import {
  EditorialStoryModal,
  InfoModal,
  JoinDirectoryModal,
  LookbookLightbox,
} from './components/InteractiveModals';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [serverHealth, setServerHealth] = useState<{
    stripeConfigured: boolean;
    squareConfigured: boolean;
    isProd: boolean;
  }>({ stripeConfigured: false, squareConfigured: false, isProd: false });
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<EditorialStory | null>(null);
  const [lightboxFrame, setLightboxFrame] = useState<SocialFrame | null>(null);
  const [infoModal, setInfoModal] = useState<'about' | 'contact' | null>(null);

  // Navigation & Hero State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Membership & Booking Checkout state (Stripe + Square)
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [checkoutTier, setCheckoutTier] = useState<MembershipTier | null>(null);
  const [checkoutCycle, setCheckoutCycle] = useState<'monthly' | 'annual'>('monthly');
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [errorTierId, setErrorTierId] = useState<string | null>(null);
  const [loadingTierId, setLoadingTierId] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<{
    tone: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [activeMemberBadge, setActiveMemberBadge] = useState<{
    planName: string;
    memberCode: string;
  } | null>(null);
  const [verifiedBooking, setVerifiedBooking] = useState<{
    reference: string;
    modelName: string;
    provider?: PaymentProvider;
  } | null>(null);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);
  const [approvedRosterModels, setApprovedRosterModels] = useState<EliteModel[]>([]);
  const [approvedDirectoryMembers, setApprovedDirectoryMembers] = useState<DirectoryMember[]>([]);
  const [clientAccessUnlocked, setClientAccessUnlocked] = useState<boolean>(
    () => sessionStorage.getItem('nycmc_client_unlocked') === '1'
  );

  // Footer newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>(
    'idle'
  );
  const [newsletterMessage, setNewsletterMessage] = useState('');

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshApprovedTalentAndDirectory = useCallback((sessionOverride?: string | null) => {
    const clientSid =
      sessionOverride !== undefined
        ? sessionOverride || ''
        : sessionStorage.getItem('nycmc_client_session_id') ||
          sessionStorage.getItem('nycmc_last_session_id') ||
          '';
    const headers: Record<string, string> = clientSid
      ? { 'X-Client-Session-Id': clientSid }
      : {};

    fetch('/api/roster/approved', { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        verifiedClient?: boolean;
        talent?: Array<{
          id: string;
          fullName: string;
          stageName: string;
          measurements: string;
          location: string;
          portfolioUrl: string;
          digitalsUrl: string;
          planId: string;
          isMinor?: boolean;
          profileVisibility?: 'public' | 'clients_only';
          visibilityScope?: 'public' | 'verified_clients_only';
        }>;
      } | null) => {
        if (data && typeof data.verifiedClient === 'boolean') {
          if (data.verifiedClient) {
            sessionStorage.setItem('nycmc_client_unlocked', '1');
            setClientAccessUnlocked(true);
          } else {
            sessionStorage.removeItem('nycmc_client_unlocked');
            setClientAccessUnlocked(false);
          }
        }
        if (data?.talent && Array.isArray(data.talent)) {
          const mapped: EliteModel[] = data.talent.map((item) => ({
            id: `roster-${item.id}`,
            name: item.stageName || item.fullName,
            division: 'Editorial',
            plateVariant: 'nadia',
            imageSrc: item.digitalsUrl || undefined,
            height: item.measurements.split('·')[0]?.trim() || '5\'10"',
            measurements: item.measurements || 'Verified Club Member',
            hair: 'Natural',
            eyes: 'Verified',
            shoe: 'NYC',
            location: item.location || 'New York, NY',
            clients: ['NYC Model Club Roster', 'New Selections'],
            bio: item.portfolioUrl
              ? `Scouted and approved into New York City Model Management from NYC Model Club (${item.portfolioUrl}).`
              : 'Scouted and approved into New York City Model Management from NYC Model Club.',
            plateCode: item.id,
            dayRateDollars: 2200,
            isMinor: Boolean(item.isMinor),
            visibility: item.profileVisibility === 'clients_only' ? 'clients_only' : 'public',
            visibilityScope:
              item.visibilityScope === 'verified_clients_only' || item.isMinor
                ? 'verified_clients_only'
                : 'public',
          }));
          setApprovedRosterModels(mapped);
        }
      })
      .catch(() => {});

    fetch('/api/directory/approved', { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        members?: Array<{
          id: string;
          fullName: string;
          role: string;
          borough: string;
          isMinor?: boolean;
          profileVisibility?: 'public' | 'clients_only';
          visibilityScope?: 'public' | 'verified_clients_only';
        }>;
      } | null) => {
        if (data?.members && Array.isArray(data.members)) {
          const mappedDir: DirectoryMember[] = data.members.map((item) => {
            const parts = item.fullName.trim().split(/\s+/);
            const initials = parts
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() || '')
              .join('');
            const isModelRole = item.role.toLowerCase().includes('model');
            return {
              id: `dir-${item.id}`,
              name: item.fullName,
              role: `${item.role} · ${item.borough}`,
              location: item.borough.includes('Brooklyn') ? 'Brooklyn' : 'Manhattan',
              initials: initials || 'MC',
              variant: 'nadia',
              category: isModelRole ? 'model' : 'creative',
              isMinor: Boolean(item.isMinor),
              visibility: item.profileVisibility === 'clients_only' ? 'clients_only' : 'public',
              visibilityScope:
                item.visibilityScope === 'verified_clients_only' || item.isMinor
                  ? 'verified_clients_only'
                  : 'public',
            };
          });
          setApprovedDirectoryMembers(mappedDir);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setServerHealth({
            stripeConfigured: Boolean(data.stripeConfigured),
            squareConfigured: Boolean(data.squareConfigured),
            isProd: data.environment === 'production',
          });
        }
      })
      .catch(() => {});

    refreshApprovedTalentAndDirectory();
  }, [refreshApprovedTalentAndDirectory, currentPath]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const checkoutParam = params.get('checkout');
    const bookingParam = params.get('booking');

    const providerParam: PaymentProvider = params.get('provider') === 'square' ? 'square' : 'stripe';
    const providerLabel = providerParam === 'square' ? 'Square' : 'Stripe';
    if (params.get('provider') === 'square') {
      setPaymentProvider('square');
    }

    if (checkoutParam === 'success') {
      const planParam = params.get('plan');
      const matchedTier =
        MEMBERSHIP_TIERS.find((t) => t.id === planParam) ||
        MEMBERSHIP_TIERS.find((t) => t.id === 'talent') ||
        MEMBERSHIP_TIERS[0];

      if (sessionId) {
        fetch(`/api/checkout-session/${encodeURIComponent(sessionId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            const resolvedLabel = data?.provider === 'square' ? 'Square' : providerLabel;
            if (data?.confirmed) {
              setActiveMemberBadge({
                planName: data.planName || `NYC Model Club: ${matchedTier.name}`,
                memberCode: data.memberCode || sessionId.slice(-6).toUpperCase(),
              });
            } else {
              setCheckoutNotice({
                tone: 'info',
                message:
                  data?.message ||
                  `Your ${resolvedLabel} payment verification is pending. Refresh shortly to confirm status.`,
              });
            }
          })
          .catch(() => {
            setCheckoutNotice({
              tone: 'error',
              message: `Unable to verify ${providerLabel} Checkout session with the server.`,
            });
          });
      } else {
        setCheckoutNotice({
          tone: 'error',
          message: `Missing ${providerLabel} Checkout session ID. Payment could not be verified.`,
        });
      }
    } else if (checkoutParam === 'cancelled') {
      setCheckoutNotice({
        tone: 'info',
        message: `${providerLabel} checkout was cancelled. Select any access tier below to resume.`,
      });
    } else if (bookingParam === 'paid' && sessionId) {
      const fallbackModel = params.get('model') || 'Represented Talent';
      fetch(`/api/checkout-session/${encodeURIComponent(sessionId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const resolvedProvider: PaymentProvider =
            data?.provider === 'square' || providerParam === 'square' ? 'square' : 'stripe';
          const resolvedLabel = resolvedProvider === 'square' ? 'Square' : 'Stripe';
          if (data?.confirmed) {
            setVerifiedBooking({
              reference: data.reference || sessionId.slice(-6).toUpperCase(),
              modelName: data.modelName || fallbackModel,
              provider: resolvedProvider,
            });
          } else {
            setBookingNotice(
              `Your ${resolvedLabel} booking payment is processing. Refresh shortly to confirm status.`
            );
          }
        })
        .catch(() => {});
    } else if (bookingParam === 'cancelled') {
      setBookingNotice(
        'Online booking checkout was cancelled. Select any represented model below to resume.'
      );
    }
  }, []);

  const normalizedPath = currentPath.replace(/\/+$/, '') || '/';

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (normalizedPath === '/membership') {
      const timer = window.setTimeout(() => scrollToSection('membership'), 60);
      return () => window.clearTimeout(timer);
    }
    if (normalizedPath === '/media-works') {
      const timer = window.setTimeout(() => scrollToSection('media-production'), 60);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [normalizedPath, scrollToSection]);

  const navigateTo = (pathWithQuery: string) => {
    setMobileMenuOpen(false);
    const parsed = new URL(pathWithQuery, window.location.origin);
    if (window.location.pathname + window.location.search !== parsed.pathname + parsed.search) {
      window.history.pushState({}, '', parsed.pathname + parsed.search);
      setCurrentPath(parsed.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navigateAndScroll = (targetPath: string, sectionId: string) => {
    setMobileMenuOpen(false);
    const parsed = new URL(targetPath, window.location.origin);
    if (window.location.pathname !== parsed.pathname) {
      window.history.pushState({}, '', parsed.pathname);
      setCurrentPath(parsed.pathname);
      window.setTimeout(() => scrollToSection(sectionId), 80);
    } else {
      scrollToSection(sectionId);
    }
  };

  const handleNavigateFromOnboarding = (target?: {
    sectionId?: string;
    workCategory?: 'Digitals';
    clientUnlocked?: boolean;
  }) => {
    if (target?.clientUnlocked) {
      sessionStorage.setItem('nycmc_client_unlocked', '1');
      const sid = sessionStorage.getItem('nycmc_last_session_id');
      if (sid) {
        sessionStorage.setItem('nycmc_client_session_id', sid);
      }
      setClientAccessUnlocked(true);
      refreshApprovedTalentAndDirectory(sid);
    }
    if (target?.sectionId === 'management') {
      navigateTo('/model-management');
      return;
    }
    if (target?.sectionId === 'latest-work') {
      navigateTo(
        target.workCategory
          ? `/latest-work?category=${encodeURIComponent(target.workCategory)}`
          : '/latest-work'
      );
      return;
    }
    if (target?.sectionId === 'directory') {
      navigateTo('/directory');
      return;
    }
    if (target?.sectionId === 'pro-news') {
      navigateTo('/pro-news');
      return;
    }
    if (target?.sectionId === 'membership' || target?.sectionId === 'media-production') {
      navigateAndScroll('/', target.sectionId);
      return;
    }
    navigateTo('/');
  };

  const defaultTalentTier =
    MEMBERSHIP_TIERS.find((t) => t.id === 'talent') || MEMBERSHIP_TIERS[MEMBERSHIP_TIERS.length - 1];

  const handleStartStripeCheckout = async (
    tier: MembershipTier,
    billingCycle: 'monthly' | 'annual',
    providerOverride?: PaymentProvider
  ) => {
    const activeProvider = providerOverride || paymentProvider;
    const providerLabel = activeProvider === 'square' ? 'Square' : 'Stripe';
    setPaymentProvider(activeProvider);
    setCheckoutError(null);
    setErrorTierId(null);
    setCheckoutNotice(null);
    setLoadingTierId(tier.id);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: tier.id,
          billingCycle,
          paymentProvider: activeProvider,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mode?: string;
        url?: string | null;
        sessionId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setErrorTierId(tier.id);
        setCheckoutError(
          data.error || `Unable to start ${providerLabel} checkout (status ${res.status}).`
        );
        return;
      }

      if (data.mode === 'stripe_redirect' || data.mode === 'square_redirect') {
        if (!data.url) {
          setErrorTierId(tier.id);
          setCheckoutError(`${providerLabel} checkout did not return a redirect URL.`);
          return;
        }
        window.location.assign(data.url);
        return;
      }

      if (data.mode === 'stripe_embedded' || data.mode === 'square_embedded') {
        setCheckoutSessionId(data.sessionId || null);
        setCheckoutCycle(billingCycle);
        setCheckoutTier(tier);
        return;
      }

      setErrorTierId(tier.id);
      setCheckoutError('Unexpected checkout response from server.');
    } catch {
      setErrorTierId(tier.id);
      setCheckoutError(`Network error initializing ${providerLabel} Checkout.`);
    } finally {
      setLoadingTierId(null);
    }
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterStatus('submitting');
    setNewsletterMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewsletterStatus('error');
        setNewsletterMessage(data.error || 'Please enter a valid email address.');
        return;
      }
      setNewsletterStatus('done');
      setNewsletterMessage(`Subscribed ${data.email} to NYC Model Club dispatches.`);
      setNewsletterEmail('');
    } catch {
      setNewsletterStatus('error');
      setNewsletterMessage('Unable to subscribe right now.');
    }
  };

  const handleVerifyClientLogin = async (
    email: string,
    memberCode: string
  ): Promise<string | null> => {
    try {
      const res = await fetch('/api/client-access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), memberCode: memberCode.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        verified?: boolean;
        sessionId?: string;
        memberCode?: string;
        planName?: string;
        error?: string;
      };
      if (!res.ok || !data.verified || !data.sessionId) {
        return data.error || 'Unable to verify Clients & Agencies pass.';
      }
      sessionStorage.setItem('nycmc_client_unlocked', '1');
      sessionStorage.setItem('nycmc_client_session_id', data.sessionId);
      sessionStorage.setItem('nycmc_last_session_id', data.sessionId);
      setClientAccessUnlocked(true);
      setActiveMemberBadge({
        planName: data.planName || 'NYC Model Club: Clients & Agencies Access',
        memberCode: data.memberCode || memberCode.trim().toUpperCase(),
      });
      refreshApprovedTalentAndDirectory(data.sessionId);
      return null;
    } catch {
      return 'Network error verifying Clients & Agencies credentials.';
    }
  };

  const handleLogoutClientAccess = () => {
    sessionStorage.removeItem('nycmc_client_unlocked');
    sessionStorage.removeItem('nycmc_client_session_id');
    setClientAccessUnlocked(false);
    refreshApprovedTalentAndDirectory(null);
  };

  const allDirectoryMembers = [...approvedDirectoryMembers, ...DIRECTORY_MEMBERS].filter(
    (m) =>
      clientAccessUnlocked ||
      (!m.isMinor &&
        m.visibility !== 'clients_only' &&
        m.visibilityScope !== 'verified_clients_only')
  );

  if (normalizedPath === '/admin') {
    return <AdminDashboard onNavigateHome={() => navigateTo('/')} />;
  }

  if (normalizedPath === '/onboarding' || normalizedPath === '/welcome') {
    return (
      <OnboardingPage
        onNavigateHome={handleNavigateFromOnboarding}
        onStartMembershipCheckout={(planId: MembershipPlanId) => {
          const tier = MEMBERSHIP_TIERS.find((t) => t.id === planId) || defaultTalentTier;
          navigateTo('/');
          void handleStartStripeCheckout(tier, 'monthly');
        }}
        onVerifiedMemberBadge={(badge) => {
          setActiveMemberBadge({
            planName: badge.planName,
            memberCode: badge.memberCode,
          });
          if (badge.planId === 'clients') {
            sessionStorage.setItem('nycmc_client_unlocked', '1');
            setClientAccessUnlocked(true);
          }
        }}
      />
    );
  }

  const isProNewsRoute = normalizedPath === '/pro-news';
  const isDirectoryRoute = normalizedPath === '/directory';
  const isLatestWorkRoute = normalizedPath === '/latest-work';
  const isManagementRoute =
    normalizedPath === '/model-management' || normalizedPath === '/models';
  const isHomeRoute = !isProNewsRoute && !isDirectoryRoute && !isLatestWorkRoute && !isManagementRoute;

  const initialWorkCategory = isLatestWorkRoute
    ? new URLSearchParams(window.location.search).get('category')
    : null;

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-6/8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-neutral-200">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line brand wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/');
            }}
            className="font-display font-extrabold text-xl tracking-[-0.04em] text-black whitespace-nowrap shrink-0"
          >
            nyc model club.
          </a>

          {/* Zone 2: Concise single-line nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-5 lg:gap-6 text-xs font-medium text-neutral-700"
          >
            <a
              href="/directory"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/directory');
              }}
              className={`hover:text-black hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                isDirectoryRoute || isLatestWorkRoute ? 'text-black font-semibold underline' : ''
              }`}
            >
              Directory
            </a>
            <a
              href="/pro-news"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/pro-news');
              }}
              className={`hover:text-black hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                isProNewsRoute ? 'text-black font-semibold underline' : ''
              }`}
            >
              Pro News
            </a>
            <a
              href="/model-management"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/model-management');
              }}
              className={`hover:text-black hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 font-semibold text-black ${
                isManagementRoute ? 'underline' : ''
              }`}
            >
              NYC Model Management
            </a>
          </nav>

          {/* Zone 3: Mobile Menu Toggle + Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="md:hidden p-1.5 border border-neutral-300 text-black hover:border-black transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => handleStartStripeCheckout(defaultTalentTier, 'monthly')}
              className="px-4 py-1.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Join Club
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-neutral-200 bg-white px-6 py-4 flex flex-col gap-3 text-xs font-medium text-neutral-700"
          >
            <a
              href="/directory"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/directory');
              }}
              className="hover:text-black"
            >
              Directory
            </a>
            <a
              href="/pro-news"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/pro-news');
              }}
              className="hover:text-black"
            >
              Pro News
            </a>
            <a
              href="/model-management"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/model-management');
              }}
              className="font-semibold text-black"
            >
              NYC Model Management
            </a>
          </nav>
        )}
      </header>

      <main id="top" className="flex-1">
        {isHomeRoute && (
          <>
            {/* SECTION 1: Hero Section */}
            <section className="max-w-[1240px] mx-auto px-6 md:px-10 pt-4 pb-10 border-b border-neutral-200">
              <div className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden border border-neutral-200 bg-neutral-100">
                {!heroImgFailed ? (
                  <>
                    <img
                      src="/images/featured-banner.png"
                      alt="NYC Model Club, Hudson Yards Rooftop Editorial Shoot"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover object-[50%_35%]"
                    />
                    <div className="absolute bottom-2.5 left-3 font-mono text-[10px] tracking-widest uppercase text-black/70 bg-white/75 px-1.5 py-0.5 pointer-events-none">
                      NYC MODEL CLUB
                    </div>
                  </>
                ) : (
                  <EditorialPlate
                    variant="hero_editorial"
                    className="w-full h-full transition-opacity duration-300"
                    label="NYC Model Club, Editorial Cover"
                  />
                )}
              </div>

              <div className="mt-6 text-center max-w-6xl mx-auto">
                <h1
                  className="font-display text-black leading-[1.1] lg:whitespace-nowrap text-balance"
                  style={{ fontSize: 'clamp(1.45rem, 3.05vw, 2.7rem)' }}
                >
                  <span className="font-bold tracking-[-0.03em]">NYC Model Club</span>{' '}
                  <span className="font-light tracking-[0.015em] text-neutral-700">
                    &middot; Open to All Models
                  </span>
                </h1>

                <div className="mt-5 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => scrollToSection('membership')}
                    className="px-6 py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Join Membership
                  </button>
                </div>
              </div>
            </section>

            {/* SECTION 2: Core Value Highlights (3-Column Overview) */}
            <section
              aria-label="Model platform pillars"
              className="border-b border-neutral-200 bg-neutral-50"
            >
              <div className="max-w-[1240px] mx-auto px-6 md:px-10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-200">
                {MODEL_VALUE_PILLARS.map((pillar, idx) => (
                  <div
                    key={pillar.indexLabel}
                    className={`py-6 ${
                      idx === 0
                        ? 'md:pr-8'
                        : idx === 1
                          ? 'md:px-8'
                          : 'md:pl-8'
                    }`}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                      {pillar.indexLabel} · {pillar.categoryTag}
                    </span>
                    <h2 className="mt-1.5 font-display font-bold text-lg tracking-tight text-black">
                      {pillar.title}
                    </h2>
                    <p className="mt-1.5 text-xs md:text-sm text-neutral-600 leading-relaxed">
                      {pillar.description}
                    </p>
                    {idx === 2 && (
                      <button
                        type="button"
                        onClick={() => setInfoModal('contact')}
                        className="mt-2.5 text-xs font-semibold text-black underline underline-offset-4 hover:text-neutral-600 cursor-pointer"
                      >
                        Safety &amp; Support Hub
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 3: Membership & Access */}
            <MembershipSection
              onSelectStripePlan={handleStartStripeCheckout}
              paymentProvider={paymentProvider}
              onChangePaymentProvider={setPaymentProvider}
              activeMemberBadge={activeMemberBadge}
              loadingTierId={loadingTierId}
              checkoutNotice={checkoutNotice}
              checkoutError={checkoutError}
              errorTierId={errorTierId}
              onOpenOnboarding={() => {
                const savedSid = sessionStorage.getItem('nycmc_last_session_id') || '';
                navigateTo(savedSid ? `/onboarding?session_id=${encodeURIComponent(savedSid)}` : '/onboarding');
              }}
            />

            {/* SECTION 4: Media & Visual Works */}
            <MediaProductionSection
              stripeConfigured={serverHealth.stripeConfigured}
              squareConfigured={serverHealth.squareConfigured}
              paymentProvider={paymentProvider}
              onChangePaymentProvider={setPaymentProvider}
              isProd={serverHealth.isProd}
              clientAccessUnlocked={clientAccessUnlocked}
              onUnlockClientAccess={() => scrollToSection('membership')}
            />
          </>
        )}

        {isProNewsRoute && (
          <ProNewsPage
            onSelectStory={setSelectedStory}
            onUnlockMembership={() => navigateAndScroll('/', 'membership')}
          />
        )}

        {(isDirectoryRoute || isLatestWorkRoute) && (
          <DirectoryPage
            key={isLatestWorkRoute ? 'latest-work' : 'directory'}
            directoryMembers={allDirectoryMembers}
            onOpenJoinModal={() => setJoinModalOpen(true)}
            onSelectLightboxFrame={setLightboxFrame}
            focusLatestWork={isLatestWorkRoute}
            initialWorkCategory={initialWorkCategory}
            onNavigateDirectory={() => navigateTo('/directory')}
            onNavigateLatestWork={() => navigateTo('/latest-work')}
          />
        )}

        {isManagementRoute && (
          <ManagementSection
            onApplyMembership={() => navigateAndScroll('/', 'membership')}
            stripeConfigured={serverHealth.stripeConfigured}
            squareConfigured={serverHealth.squareConfigured}
            paymentProvider={paymentProvider}
            onChangePaymentProvider={setPaymentProvider}
            isProd={serverHealth.isProd}
            verifiedBooking={verifiedBooking}
            bookingNotice={bookingNotice}
            approvedRosterModels={approvedRosterModels}
            clientAccessUnlocked={clientAccessUnlocked}
            onVerifyClientLogin={handleVerifyClientLogin}
            onLogoutClientAccess={handleLogoutClientAccess}
          />
        )}
      </main>

      {/* Dark Editorial Footer */}
      <footer className="bg-[#141414] text-white border-t border-neutral-800 pt-12 pb-10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          {/* Top Footer Columns */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-neutral-800">
            <div className="md:col-span-4 flex items-start gap-4 text-neutral-300">
              <button
                type="button"
                onClick={() => setLightboxFrame(SOCIAL_FRAMES[0])}
                aria-label="Instagram"
                className="hover:text-white transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxFrame(SOCIAL_FRAMES[1])}
                aria-label="Share"
                className="hover:text-white transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxFrame(SOCIAL_FRAMES[2])}
                aria-label="YouTube"
                className="hover:text-white transition-colors"
              >
                <Youtube className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setInfoModal('contact')}
                aria-label="Email"
                className="hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4" />
              </button>
            </div>

            <div className="md:col-span-2 space-y-2 text-xs text-neutral-400">
              <p className="font-semibold text-white mb-2">Divisions</p>
              <button
                type="button"
                onClick={() => navigateAndScroll('/', 'membership')}
                className="block hover:text-white cursor-pointer"
              >
                Membership ($29 to $99)
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/model-management')}
                className="block hover:text-white cursor-pointer"
              >
                NYC Model Management
              </button>
              <button
                type="button"
                onClick={() => navigateAndScroll('/', 'media-production')}
                className="block hover:text-white cursor-pointer"
              >
                Media &amp; Visual Works
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/pro-news')}
                className="block hover:text-white cursor-pointer"
              >
                Pro News
              </button>
              <button
                type="button"
                onClick={() => setInfoModal('contact')}
                className="block hover:text-white cursor-pointer"
              >
                Contact &amp; Studio Line
              </button>
            </div>

            <div className="md:col-span-2 space-y-2 text-xs text-neutral-400">
              <p className="font-semibold text-white mb-2">Community</p>
              <a
                href="/directory"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/directory');
                }}
                className="block hover:text-white"
              >
                Member Directory
              </a>
              <a
                href="/latest-work"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/latest-work');
                }}
                className="block hover:text-white"
              >
                Latest Work
              </a>
              <button
                type="button"
                onClick={() => setJoinModalOpen(true)}
                className="block hover:text-white cursor-pointer"
              >
                Open Application
              </button>
              <button
                type="button"
                onClick={() => setInfoModal('about')}
                className="block hover:text-white cursor-pointer"
              >
                About Us
              </button>
            </div>

            <div className="md:col-span-4">
              <p className="font-semibold text-xs text-white mb-2">Join Our Dispatch List</p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Email Address"
                  aria-label="Email Address"
                  className="flex-1 px-3 py-2 bg-black border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === 'submitting'}
                  className="px-4 py-2 bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors whitespace-nowrap"
                >
                  {newsletterStatus === 'submitting' ? 'Saving...' : 'Sign Up'}
                </button>
              </form>
              {newsletterMessage && (
                <p
                  className={`mt-2 text-[11px] ${
                    newsletterStatus === 'error' ? 'text-red-400' : 'text-neutral-300'
                  }`}
                  role="status"
                >
                  {newsletterMessage}
                </p>
              )}
            </div>
          </div>

          {/* Contact & Quick Actions */}
          <div className="pt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="text-xs text-neutral-400 space-y-1">
              <p className="font-semibold text-white">Contact &amp; Studio Line</p>
              <p>
                Direct Inquiries:{' '}
                <a
                  href={`mailto:${CONTACT_CONFIG.directInquiriesEmail}`}
                  className="text-neutral-200 underline underline-offset-4 hover:text-white"
                >
                  {CONTACT_CONFIG.directInquiriesEmail}
                </a>{' '}
                <span className="text-neutral-600" aria-hidden="true">
                  |
                </span>{' '}
                {CONTACT_CONFIG.officeLabel}:{' '}
                <span className="text-neutral-200">{CONTACT_CONFIG.officeAddress}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleStartStripeCheckout(defaultTalentTier, 'monthly')}
                className="px-4 py-2 bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Apply &amp; Pay Membership
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/model-management')}
                className="px-4 py-2 border border-neutral-600 text-white text-xs font-semibold hover:border-white transition-colors cursor-pointer"
              >
                Agency Bookings
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span
              onDoubleClick={() => navigateTo('/admin')}
              className="font-display font-extrabold text-2xl tracking-[-0.04em] text-white"
            >
              nyc model club.
            </span>
            <span className="text-[11px] text-neutral-500">
              NYC Model Club · Open to All Models · New York City Model Management ·{' '}
              {CONTACT_CONFIG.officeAddress}
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <JoinDirectoryModal
        open={joinModalOpen}
        clientAccessUnlocked={clientAccessUnlocked}
        directoryMembers={allDirectoryMembers}
        onClose={() => setJoinModalOpen(false)}
        onProceedToMembership={() => handleStartStripeCheckout(defaultTalentTier, 'monthly')}
      />

      <StripeCheckoutModal
        tier={checkoutTier}
        billingCycle={checkoutCycle}
        sessionId={checkoutSessionId}
        paymentProvider={paymentProvider}
        onChangePaymentProvider={setPaymentProvider}
        onClose={() => setCheckoutTier(null)}
        onSuccess={(badge) => {
          setActiveMemberBadge({
            planName: badge.planName,
            memberCode: badge.memberCode,
          });
          if (badge.planId === 'clients') {
            sessionStorage.setItem('nycmc_client_unlocked', '1');
            if (badge.sessionId) {
              sessionStorage.setItem('nycmc_client_session_id', badge.sessionId);
            }
            setClientAccessUnlocked(true);
            refreshApprovedTalentAndDirectory(badge.sessionId);
          }
          if (badge.sessionId) {
            sessionStorage.setItem('nycmc_last_session_id', badge.sessionId);
          }
          setCheckoutTier(null);
          navigateTo(
            `/onboarding?session_id=${encodeURIComponent(
              badge.sessionId
            )}&plan=${badge.planId}&cycle=${badge.billingCycle}`
          );
        }}
      />

      <EditorialStoryModal
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
        onUnlockMembership={() => handleStartStripeCheckout(defaultTalentTier, 'monthly')}
      />

      <LookbookLightbox
        frame={lightboxFrame}
        onClose={() => setLightboxFrame(null)}
      />

      <InfoModal
        section={infoModal}
        onClose={() => setInfoModal(null)}
        onJumpToManagement={() => navigateTo('/model-management')}
      />
    </div>
  );
}
