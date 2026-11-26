import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  MailCheck,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  CONTACT_CONFIG,
  MEMBERSHIP_TIERS,
  MembershipPlanId,
  calculateExactAge,
} from '../data/clubData';

interface OnboardingRecordPayload {
  id: string;
  plan_id: MembershipPlanId;
  billing_cycle: 'monthly' | 'annual';
  email: string;
  full_name: string;
  stage_name: string;
  measurements: string;
  location: string;
  portfolio_url: string;
  digitals_url: string;
  studio_shoot_slot: string;
  company_name: string;
  company_role: string;
  project_type: string;
  date_of_birth?: string;
  is_minor?: number;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  parent_consent?: number;
  profile_visibility?: 'public' | 'clients_only';
  visibility_scope?: 'public' | 'verified_clients_only';
  review_status: string;
  confirmation_notified_at: string | null;
  confirmation_channel: string;
}

interface VerifiedSessionInfo {
  confirmed: boolean;
  planId: MembershipPlanId;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountCents: number;
  paymentStatus: string;
  memberCode: string;
  email: string;
  fullName: string;
  dateOfBirth?: string;
  isMinor?: boolean;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentConsent?: boolean;
  visibilityScope?: 'public' | 'verified_clients_only';
  onboarding?: OnboardingRecordPayload | null;
}

interface OnboardingPageProps {
  onNavigateHome: (target?: { sectionId?: string; workCategory?: 'Digitals'; clientUnlocked?: boolean }) => void;
  onStartMembershipCheckout: (planId: MembershipPlanId) => void;
  onVerifiedMemberBadge: (badge: { planName: string; memberCode: string; planId: MembershipPlanId }) => void;
}

const STUDIO_TIME_WINDOWS = [
  'Morning · 10:00 AM to 12:30 PM',
  'Afternoon · 1:30 PM to 4:00 PM',
  'Late Afternoon · 4:30 PM to 6:30 PM',
];

const CLIENT_ROLES = ['Casting Director', 'Brand', 'Agency'] as const;

const CLIENT_PROJECT_TYPES = [
  'Runway / Presentation',
  'Editorial / Campaign',
  'Lookbook / E-Commerce Catalog',
  'AI Model Licensing',
  'Models + Media Production Bundle',
];

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format. Please upload JPG, PNG, or WebP.'));
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser canvas unavailable for image processing.'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressed);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  onNavigateHome,
  onStartMembershipCheckout,
  onVerifiedMemberBadge,
}) => {
  const [verifying, setVerifying] = useState(true);
  const [verifyingMessage, setVerifyingMessage] = useState(
    'Confirming your membership activation...'
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<VerifiedSessionInfo | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Talent / Studio form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [stageName, setStageName] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [location, setLocation] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [digitalsUrl, setDigitalsUrl] = useState('');
  const [digitalsFileName, setDigitalsFileName] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);

  // $59 Studio Access Ripley Grier Studios (Manhattan) booking preference
  const [studioDate, setStudioDate] = useState('');
  const [studioWindow, setStudioWindow] = useState(STUDIO_TIME_WINDOWS[0]);
  const [studioNotes, setStudioNotes] = useState('');

  // $99 Client & Agency form state
  const [companyName, setCompanyName] = useState('');
  const [companyRole, setCompanyRole] = useState<string>(CLIENT_ROLES[0]);
  const [projectType, setProjectType] = useState(CLIENT_PROJECT_TYPES[0]);

  // Minor / parent registration state (driven automatically by Date of Birth)
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentConsent, setParentConsent] = useState(false);

  const calculatedAge = calculateExactAge(dateOfBirth);
  const isMinor = calculatedAge !== null && calculatedAge < 18;
  const todayIso = new Date().toISOString().slice(0, 10);

  // Submission & confirmation notification state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<OnboardingRecordPayload | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramSessionId =
      params.get('session_id')?.trim() || sessionStorage.getItem('nycmc_last_session_id') || '';
    const paramPlanRaw = params.get('plan');
    const paramPlan: MembershipPlanId =
      paramPlanRaw === 'studio' || paramPlanRaw === 'clients' ? paramPlanRaw : 'talent';
    const paramCycle = params.get('cycle') === 'annual' ? 'annual' : 'monthly';

    if (!paramSessionId) {
      setVerifying(false);
      setVerifyError(
        'No active Stripe checkout session was detected. Complete checkout on any membership tier to unlock onboarding.'
      );
      return;
    }

    setSessionId(paramSessionId);
    sessionStorage.setItem('nycmc_last_session_id', paramSessionId);

    const hydrateFromRecord = (info: VerifiedSessionInfo) => {
      setSessionInfo(info);
      setEmail(info.email || '');
      setFullName(info.fullName || '');
      onVerifiedMemberBadge({
        planName: info.planName,
        memberCode: info.memberCode,
        planId: info.planId,
      });

      if (info.onboarding) {
        const ob = info.onboarding;
        setSavedRecord(ob);
        setEmail(ob.email || info.email || '');
        setFullName(ob.full_name || info.fullName || '');
        setStageName(ob.stage_name || '');
        setMeasurements(ob.measurements || '');
        setLocation(ob.location || '');
        setPortfolioUrl(ob.portfolio_url || '');
        setDigitalsUrl(ob.digitals_url || '');
        setCompanyName(ob.company_name || '');
        if (ob.company_role) setCompanyRole(ob.company_role);
        if (ob.project_type) setProjectType(ob.project_type);
        setDateOfBirth(ob.date_of_birth || info.dateOfBirth || '');
        setParentName(ob.parent_name || info.parentName || '');
        setParentEmail(ob.parent_email || info.parentEmail || '');
        setParentPhone(ob.parent_phone || info.parentPhone || '');
        setParentConsent(ob.parent_consent === 1 || Boolean(info.parentConsent));
        if (ob.studio_shoot_slot) {
          const [datePart, ...rest] = ob.studio_shoot_slot.split(' · ');
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            setStudioDate(datePart);
            if (rest.length > 0) setStudioNotes(rest.join(' · '));
          } else {
            setStudioNotes(ob.studio_shoot_slot);
          }
        }
      } else if (info.dateOfBirth) {
        setDateOfBirth(info.dateOfBirth);
        setParentName(info.parentName || '');
        setParentEmail(info.parentEmail || '');
        setParentPhone(info.parentPhone || '');
        setParentConsent(Boolean(info.parentConsent));
      }
    };

    let cancelled = false;
    let pollTimer: number | undefined;
    let attempts = 0;
    const maxWebhookPollAttempts = 15;

    const verifyCheckoutSession = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/checkout-session/${encodeURIComponent(paramSessionId)}`);
        const data = (await res.json().catch(() => ({}))) as Partial<VerifiedSessionInfo> & {
          pendingWebhook?: boolean;
          message?: string;
          error?: string;
        };

        if (cancelled) return;

        if (data.pendingWebhook) {
          setVerifyingMessage(
            data.message ||
              'Awaiting verified Stripe checkout.session.completed webhook confirmation...'
          );
          if (attempts < maxWebhookPollAttempts) {
            pollTimer = window.setTimeout(() => {
              void verifyCheckoutSession();
            }, 1500);
            return;
          }
          setVerifyError(
            'Stripe payment confirmation webhook has not arrived yet. Please refresh this page in a few seconds.'
          );
          setVerifying(false);
          return;
        }

        if (!res.ok || !data.confirmed) {
          if (res.status === 403 || res.status === 404) {
            sessionStorage.removeItem('nycmc_last_session_id');
          }
          setVerifyError(
            data.error ||
              'Payment has not been verified by Stripe checkout.session.completed.'
          );
          setVerifying(false);
          return;
        }

        const resolvedPlanId: MembershipPlanId =
          data.planId === 'studio' || data.planId === 'clients' || data.planId === 'talent'
            ? data.planId
            : paramPlan;
        const tierObj =
          MEMBERSHIP_TIERS.find((t) => t.id === resolvedPlanId) || MEMBERSHIP_TIERS[0];

        hydrateFromRecord({
          confirmed: true,
          planId: resolvedPlanId,
          planName: data.planName || `NYC Model Club: ${tierObj.name}`,
          billingCycle: data.billingCycle === 'annual' ? 'annual' : paramCycle,
          amountCents:
            typeof data.amountCents === 'number'
              ? data.amountCents
              : paramCycle === 'annual'
                ? tierObj.annualMonthlyPrice * 12 * 100
                : tierObj.monthlyPrice * 100,
          paymentStatus: data.paymentStatus || 'Paid · Active',
          memberCode: data.memberCode || paramSessionId.slice(-6).toUpperCase(),
          email: data.email || '',
          fullName: data.fullName || '',
          dateOfBirth: data.dateOfBirth || '',
          isMinor: Boolean(data.isMinor),
          parentName: data.parentName || '',
          parentEmail: data.parentEmail || '',
          parentPhone: data.parentPhone || '',
          parentConsent: Boolean(data.parentConsent),
          visibilityScope: data.visibilityScope,
          onboarding: data.onboarding || null,
        });
        setVerifying(false);
      } catch {
        if (!cancelled) {
          setVerifyError('Network error verifying Stripe Checkout session.');
          setVerifying(false);
        }
      }
    };

    void verifyCheckoutSession();

    return () => {
      cancelled = true;
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [onVerifiedMemberBadge]);

  const handleDigitalsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a JPG, PNG, or WebP headshot/digital image.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setFormError('Image file must be under 12MB.');
      return;
    }

    setUploadBusy(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setDigitalsUrl(compressed);
      setDigitalsFileName(file.name);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to process uploaded headshot.');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSubmitOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionInfo) return;
    setFormError(null);
    setNotificationMessage(null);

    const planId = sessionInfo.planId;
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid email address for your membership confirmation.');
      return;
    }

    let combinedShootSlot = '';
    if (planId === 'studio') {
      if (!studioDate) {
        setFormError('Please choose your preferred date for the monthly Ripley Grier Studios (Manhattan) shoot.');
        return;
      }
      combinedShootSlot = [studioDate, studioWindow, studioNotes.trim()].filter(Boolean).join(' · ');
    }

    if (planId === 'clients') {
      if (companyName.trim().length < 2) {
        setFormError('Please enter your company or brand name.');
        return;
      }
    } else {
      if (fullName.trim().length < 2 || measurements.trim().length < 2 || location.trim().length < 2) {
        setFormError('Please complete your full name, height/measurements, and location.');
        return;
      }
      if (calculatedAge === null) {
        setFormError('Please enter a valid Date of Birth.');
        return;
      }
      if (isMinor) {
        if (parentName.trim().length < 2) {
          setFormError(
            'Applicants under 18 must be registered by a parent. Please enter the parent full name.'
          );
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
          setFormError('Please provide a valid parent email address.');
          return;
        }
        if (parentPhone.replace(/\D/g, '').length < 7) {
          setFormError('Please provide a valid parent phone number.');
          return;
        }
        if (!parentConsent) {
          setFormError(
            'Parent consent confirmation is required to register an applicant under 18.'
          );
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          planId,
          billingCycle: sessionInfo.billingCycle,
          email: email.trim(),
          fullName: fullName.trim(),
          stageName: stageName.trim(),
          measurements: measurements.trim(),
          location: location.trim(),
          portfolioUrl: portfolioUrl.trim(),
          digitalsUrl: digitalsUrl.trim(),
          studioShootSlot: combinedShootSlot,
          companyName: companyName.trim(),
          companyRole,
          projectType,
          dateOfBirth: planId !== 'clients' ? dateOfBirth : '',
          isMinor: planId !== 'clients' && isMinor,
          visibilityScope:
            planId !== 'clients' && isMinor ? 'verified_clients_only' : 'public',
          parentName: planId !== 'clients' && isMinor ? parentName.trim() : '',
          parentEmail: planId !== 'clients' && isMinor ? parentEmail.trim().toLowerCase() : '',
          parentPhone: planId !== 'clients' && isMinor ? parentPhone.trim() : '',
          parentConsent: planId !== 'clients' && isMinor && parentConsent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        saved?: boolean;
        onboarding?: OnboardingRecordPayload;
        notification?: { sent: boolean; channel: string; message: string };
        error?: string;
      };

      if (!res.ok || !data.saved || !data.onboarding) {
        setFormError(data.error || 'Unable to save onboarding profile. Please review your details.');
        return;
      }

      setSavedRecord(data.onboarding);
      setNotificationMessage(
        data.notification?.message ||
          `Confirmation notice dispatched to ${data.onboarding.email} and logged with NYC Model Management.`
      );
    } catch {
      setFormError('Network error saving onboarding profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeTierMeta =
    MEMBERSHIP_TIERS.find((t) => t.id === sessionInfo?.planId) || MEMBERSHIP_TIERS[0];

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-neutral-200">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between gap-8">
          <div className="flex items-baseline gap-3 whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => onNavigateHome()}
              className="font-display font-extrabold text-xl tracking-[-0.04em] text-black cursor-pointer"
            >
              nyc model club.
            </button>
            <span className="text-xs text-neutral-400">/</span>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-600">
              Member Onboarding · Open to All Models
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigateHome()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Site</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1060px] w-full mx-auto px-6 md:px-10 py-10 md:py-16">
        {verifying ? (
          <div className="border border-neutral-200 p-10 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
              Verifying Stripe Checkout Session
            </p>
            <h1 className="font-editorial italic text-3xl mt-2 text-black">
              {verifyingMessage}
            </h1>
          </div>
        ) : verifyError || !sessionInfo ? (
          <div className="border border-black p-8 md:p-12">
            <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
              Membership Activation Required
            </p>
            <h1 className="font-editorial italic text-3xl md:text-4xl mt-2 text-black">
              Complete Checkout to Begin Onboarding.
            </h1>
            <p className="mt-3 text-sm text-neutral-600 max-w-xl leading-relaxed">
              {verifyError ||
                'Select one of our three access tiers below to complete Stripe Checkout and unlock your personalized onboarding desk.'}
            </p>
            <div className="mt-4 inline-flex flex-wrap items-center gap-2.5 border border-black bg-neutral-50 px-3.5 py-2">
              <span className="px-2 py-0.5 bg-black text-white font-mono text-[10px] font-semibold uppercase tracking-wider">
                Discounted Pre-Sale / Early Bird Prices
              </span>
              <span className="text-xs text-neutral-700">
                Regular membership starts at $35/month starting February 2027.
              </span>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {MEMBERSHIP_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onStartMembershipCheckout(tier.id)}
                  className="p-5 border border-neutral-300 hover:border-black text-left transition-colors cursor-pointer"
                >
                  <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    ${tier.monthlyPrice}/mo
                  </p>
                  <p className="font-display font-bold text-base text-black mt-1">{tier.name}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4">
                    <span>Activate Tier</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigateHome()}
              className="mt-8 px-5 py-2.5 border border-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Return to NYC Model Club
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 1. Payment Confirmation Banner */}
            <section
              aria-label="Payment Confirmation"
              className="bg-[#0A0A0A] text-white border border-black p-7 md:p-10"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-7 border-b border-neutral-800">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                    <CheckCircle2 className="w-4 h-4 text-white" aria-hidden="true" />
                    <span>Open to All Models · Stripe Payment Confirmed</span>
                  </div>
                  <h1
                    className="font-editorial italic font-normal text-white mt-3 leading-[1.04]"
                    style={{ fontSize: 'clamp(2.1rem, 4vw, 3.3rem)' }}
                  >
                    Welcome to NYC Model Club.
                  </h1>
                  <p className="mt-3 text-sm text-neutral-300 max-w-2xl leading-relaxed">
                    Your <strong className="text-white">{activeTierMeta.name}</strong> pass is now
                    active. Complete your onboarding profile below so our New York City Model
                    Management desk can finalize your access and roster visibility.
                  </p>
                </div>

                <div className="border border-neutral-700 bg-black p-4 min-w-[220px] shrink-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                    Verified Club Pass
                  </p>
                  <p className="font-mono font-bold text-lg text-white mt-1 tabular-nums">
                    {sessionInfo.memberCode}
                  </p>
                  <p className="font-mono text-[11px] text-neutral-300 mt-1">
                    {sessionInfo.paymentStatus}
                  </p>
                </div>
              </div>

              <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                <div>
                  <p className="font-mono uppercase tracking-wider text-neutral-500 text-[10px]">
                    Active Membership Tier
                  </p>
                  <p className="text-white font-semibold mt-1">{activeTierMeta.name}</p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-wider text-neutral-500 text-[10px]">
                    Billing &amp; Status
                  </p>
                  <p className="text-white font-semibold mt-1 tabular-nums">
                    ${(sessionInfo.amountCents / 100).toFixed(2)} ·{' '}
                    {sessionInfo.billingCycle === 'annual' ? 'Annual Plan' : 'Monthly Plan'} · Paid
                  </p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-wider text-neutral-500 text-[10px]">
                    Account Email
                  </p>
                  <p className="text-white font-semibold mt-1 truncate">
                    {email || sessionInfo.email || 'Confirmed via Stripe'}
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Client & Agency Instant Access Deck ($99 Tier) */}
            {sessionInfo.planId === 'clients' && (
              <section
                aria-label="Client and Agency Instant Access"
                className="border border-black bg-neutral-50 p-7 md:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-neutral-200">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                      Clients &amp; Agencies Access · Unlocked Now
                    </p>
                    <h2 className="font-display font-bold text-xl text-black mt-1">
                      Instant Agency &amp; Casting Desk Access
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-neutral-600">
                    15% Preferred Client Member Discount &amp; Private Rate Desk
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateHome({ sectionId: 'management', clientUnlocked: true })
                    }
                    className="p-5 bg-black text-white text-left hover:bg-neutral-800 transition-colors cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                        01 · Direct Talent
                      </p>
                      <p className="font-display font-bold text-base mt-1">
                        Unlock Full Verified Roster
                      </p>
                      <p className="text-xs text-neutral-300 mt-1.5">
                        Browse Runway, Editorial, Commercial &amp; AI Model Representation.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                      <span>Open Roster</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigateHome({
                        sectionId: 'latest-work',
                        workCategory: 'Digitals',
                        clientUnlocked: true,
                      })
                    }
                    className="p-5 bg-white border border-black text-black text-left hover:bg-neutral-100 transition-colors cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        02 · Raw Casting Plates
                      </p>
                      <p className="font-display font-bold text-base mt-1">
                        View Unretouched Digitals
                      </p>
                      <p className="text-xs text-neutral-600 mt-1.5">
                        Inspect Polaroids, daylight measurements, and raw studio digitals.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                      <span>Open Digitals</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigateHome({ sectionId: 'media-production', clientUnlocked: true })
                    }
                    className="p-5 bg-white border border-black text-black text-left hover:bg-neutral-100 transition-colors cursor-pointer flex flex-col justify-between gap-4"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        03 · Booking &amp; Production
                      </p>
                      <p className="font-display font-bold text-base mt-1">
                        Open Agency Rate Desk
                      </p>
                      <p className="text-xs text-neutral-600 mt-1.5">
                        Book Models Only, Media Production Only, or Bundled Lookbook shoots.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                      <span>Open Rate Desk</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </button>
                </div>
              </section>
            )}

            {/* 3. Confirmation Notification Banner after submission */}
            {savedRecord && (
              <section
                aria-label="Onboarding saved confirmation"
                className="border border-black bg-neutral-50 p-6 md:p-8"
                role="status"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-black">
                      <MailCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Onboarding Profile Saved &amp; Confirmation Triggered</span>
                    </div>
                    <h2 className="font-display font-bold text-xl text-black">
                      Reference {savedRecord.id} · Received by New York City Model Management
                    </h2>
                    <p className="text-xs md:text-sm text-neutral-700 leading-relaxed max-w-2xl">
                      {notificationMessage ||
                        `A confirmation dispatch has been sent to ${savedRecord.email}. Our scouting and booking desk can now review your profile inside New Members & Onboarding.`}
                    </p>
                    {savedRecord.plan_id === 'studio' && savedRecord.studio_shoot_slot && (
                      <p className="text-xs font-mono text-black pt-1">
                        Requested Ripley Grier Studios (Manhattan) Shoot: {savedRecord.studio_shoot_slot}
                      </p>
                    )}
                    {(savedRecord.is_minor === 1 ||
                      savedRecord.profile_visibility === 'clients_only' ||
                      savedRecord.visibility_scope === 'verified_clients_only') && (
                      <p className="text-xs font-mono text-black pt-1">
                        Privacy Status: Private / Restricted (Minor Profile · Parent:{' '}
                        {savedRecord.parent_name} · Visible exclusively to verified Clients &amp;
                        Agencies)
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigateHome({ sectionId: 'management' })}
                      className="px-5 py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Explore NYC Model Club
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 4. Tier-Specific Onboarding Form */}
            <section
              aria-label="Tier onboarding form"
              className="border border-neutral-200 p-7 md:p-10 bg-white"
            >
              <div className="pb-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    {sessionInfo.planId === 'clients'
                      ? 'Client & Agency Company Onboarding'
                      : sessionInfo.planId === 'studio'
                        ? 'Model Profile & Studio Shoot Scheduling'
                        : 'Model & Talent Onboarding Profile Builder'}
                  </p>
                  <h2 className="font-editorial italic text-3xl text-black mt-1">
                    {sessionInfo.planId === 'clients'
                      ? 'Register Your Brand or Casting Desk.'
                      : 'Build Your Agency Scouting Profile.'}
                  </h2>
                </div>
                {savedRecord && (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600">
                    Saved · You may update below anytime
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmitOnboarding} className="mt-7 space-y-6">
                {sessionInfo.planId === 'clients' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="ob-company-name"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Company / Brand Name *
                        </label>
                        <input
                          id="ob-company-name"
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g., Atelier Mercer / Vogue Casting"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-client-role"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Role *
                        </label>
                        <select
                          id="ob-client-role"
                          value={companyRole}
                          onChange={(e) => setCompanyRole(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-neutral-300 bg-white text-sm focus:border-black focus:outline-none"
                        >
                          {CLIENT_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="ob-project-type"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Project Type *
                        </label>
                        <select
                          id="ob-project-type"
                          value={projectType}
                          onChange={(e) => setProjectType(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-neutral-300 bg-white text-sm focus:border-black focus:outline-none"
                        >
                          {CLIENT_PROJECT_TYPES.map((pt) => (
                            <option key={pt} value={pt}>
                              {pt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="ob-client-email"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Confirmation Email *
                        </label>
                        <input
                          id="ob-client-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="casting@brand.com"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="ob-client-contact"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Primary Contact Name
                        </label>
                        <input
                          id="ob-client-contact"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jordan Sinclair"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ob-client-location"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Office / Shoot City
                        </label>
                        <input
                          id="ob-client-location"
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="SoHo, New York"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="ob-full-name"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Full Name *
                        </label>
                        <input
                          id="ob-full-name"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Legal / Full Name"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-stage-name"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Stage Name
                        </label>
                        <input
                          id="ob-stage-name"
                          type="text"
                          value={stageName}
                          onChange={(e) => setStageName(e.target.value)}
                          placeholder="Optional working / editorial name"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-measurements"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Height / Measurements *
                        </label>
                        <input
                          id="ob-measurements"
                          type="text"
                          required
                          value={measurements}
                          onChange={(e) => setMeasurements(e.target.value)}
                          placeholder={`e.g., 5'10" · 32-24-34 · Shoe 8.5`}
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-location"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Location *
                        </label>
                        <input
                          id="ob-location"
                          type="text"
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., Manhattan / Brooklyn, NY"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-portfolio"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Instagram / Portfolio Link
                        </label>
                        <input
                          id="ob-portfolio"
                          type="text"
                          value={portfolioUrl}
                          onChange={(e) => setPortfolioUrl(e.target.value)}
                          placeholder="@handle or https://portfolio.com"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-talent-email"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Confirmation Email *
                        </label>
                        <input
                          id="ob-talent-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="model@nycmodelclub.com"
                          className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ob-dob"
                          className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                        >
                          Date of Birth *
                        </label>
                        <input
                          id="ob-dob"
                          type="date"
                          required
                          max={todayIso}
                          value={dateOfBirth}
                          onChange={(e) => {
                            const nextDob = e.target.value;
                            setDateOfBirth(nextDob);
                            const nextAge = calculateExactAge(nextDob);
                            if (nextAge === null || nextAge >= 18) {
                              setParentConsent(false);
                            }
                          }}
                          className="w-full px-3.5 py-2.5 border border-neutral-300 bg-white text-sm focus:border-black focus:outline-none"
                        />
                        {calculatedAge !== null && (
                          <p className="mt-1 font-mono text-[11px] text-neutral-700">
                            {isMinor
                              ? `Age ${calculatedAge} · Minor Detected · Visibility: Verified Clients & Agencies Only`
                              : `Age ${calculatedAge} · Standard Roster Eligibility`}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Under-18 Compliance: Applicants under 18 are automatically flagged as minors,
                      must be registered by a parent, and are hidden from all open public Roster
                      and Member Directory pages.
                    </p>

                    {isMinor && (
                      <div className="border border-black bg-neutral-50 p-5 space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-black">
                            Parent Registration Required (Age Under 18)
                          </p>
                          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                            This profile is automatically set to Verified Clients &amp; Agencies
                            visibility only and will never appear on public Roster or Member
                            Directory pages.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label
                              htmlFor="ob-parent-name"
                              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                            >
                              Parent Full Name *
                            </label>
                            <input
                              id="ob-parent-name"
                              type="text"
                              required
                              value={parentName}
                              onChange={(e) => setParentName(e.target.value)}
                              placeholder="Parent full name"
                              className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 text-sm focus:border-black focus:outline-none"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="ob-parent-email"
                              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                            >
                              Parent Email *
                            </label>
                            <input
                              id="ob-parent-email"
                              type="email"
                              required
                              value={parentEmail}
                              onChange={(e) => setParentEmail(e.target.value)}
                              placeholder="parent@domain.com"
                              className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 text-sm focus:border-black focus:outline-none"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="ob-parent-phone"
                              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                            >
                              Parent Phone *
                            </label>
                            <input
                              id="ob-parent-phone"
                              type="tel"
                              required
                              value={parentPhone}
                              onChange={(e) => setParentPhone(e.target.value)}
                              placeholder="(212) 555-0194"
                              className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 text-sm focus:border-black focus:outline-none"
                            />
                          </div>
                        </div>

                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            id="ob-parent-consent"
                            type="checkbox"
                            required
                            checked={parentConsent}
                            onChange={(e) => setParentConsent(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-black shrink-0"
                          />
                          <span className="text-xs text-neutral-700 leading-snug">
                            I confirm I am the parent registering this minor and give consent for
                            private visibility restricted exclusively to verified Clients &amp;
                            Agencies. *
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Digitals / Headshot Upload */}
                    <div className="border border-neutral-200 p-5 bg-neutral-50">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-black">
                            Digitals / Headshot Upload
                          </p>
                          <p className="text-xs text-neutral-600 mt-1">
                            Upload a clean, unretouched daylight headshot or digital (JPG, PNG, WebP)
                            or paste a hosted portfolio photo URL.
                          </p>
                        </div>

                        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0">
                          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{uploadBusy ? 'Optimizing...' : 'Upload Headshot'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => void handleDigitalsUpload(e)}
                            className="sr-only"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-9">
                          <input
                            type="url"
                            value={digitalsUrl.startsWith('data:image/') ? '' : digitalsUrl}
                            onChange={(e) => {
                              setDigitalsFileName('');
                              setDigitalsUrl(e.target.value);
                            }}
                            placeholder={
                              digitalsUrl.startsWith('data:image/')
                                ? `Uploaded file ready (${digitalsFileName || 'headshot.jpg'})`
                                : 'Or paste direct image URL (https://...)'
                            }
                            aria-label="Digitals image URL"
                            className="w-full px-3.5 py-2 bg-white border border-neutral-300 text-xs focus:border-black focus:outline-none"
                          />
                        </div>
                        <div className="md:col-span-3 flex items-center gap-3">
                          {digitalsUrl ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={digitalsUrl}
                                alt="Uploaded digital headshot preview"
                                className="w-14 h-18 object-cover border border-neutral-300 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setDigitalsUrl('');
                                  setDigitalsFileName('');
                                }}
                                className="text-[11px] underline text-neutral-600 hover:text-black cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono text-neutral-500">
                              No photo attached
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* $59 Studio Access Exclusive: Ripley Grier Studios (Manhattan) Shoot Scheduler */}
                    {sessionInfo.planId === 'studio' && (
                      <div className="border border-black p-6 bg-neutral-50">
                        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-black">
                          <Camera className="w-4 h-4" aria-hidden="true" />
                          <span>$59 Studio Access Benefit · Ripley Grier Studios (Manhattan)</span>
                        </div>
                        <h3 className="font-display font-bold text-lg text-black mt-1.5">
                          Request Your Monthly Studio Shoot Session
                        </h3>
                        <p className="text-xs text-neutral-600 mt-1">
                          Select your preferred date and session window for our monthly NYC test
                          shoot, Polaroid update, and studio digitals at Ripley Grier Studios in
                          Manhattan, NY.
                        </p>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label
                              htmlFor="ob-studio-date"
                              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                            >
                              Preferred Shoot Date *
                            </label>
                            <div className="relative">
                              <input
                                id="ob-studio-date"
                                type="date"
                                required
                                value={studioDate}
                                onChange={(e) => setStudioDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 text-sm focus:border-black focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="ob-studio-window"
                              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                            >
                              Preferred Time Window *
                            </label>
                            <select
                              id="ob-studio-window"
                              value={studioWindow}
                              onChange={(e) => setStudioWindow(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 text-sm focus:border-black focus:outline-none"
                            >
                              {STUDIO_TIME_WINDOWS.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor="ob-studio-notes"
                              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                            >
                              Look / Shoot Focus
                            </label>
                            <input
                              id="ob-studio-notes"
                              type="text"
                              value={studioNotes}
                              onChange={(e) => setStudioNotes(e.target.value)}
                              placeholder="Digitals + Clean Beauty Test"
                              className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 text-sm focus:border-black focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {formError && (
                  <p className="text-xs text-red-600 font-medium" role="alert">
                    {formError}
                  </p>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-neutral-200">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <ShieldCheck className="w-4 h-4 text-black shrink-0" aria-hidden="true" />
                    <span>
                      Submitted directly to New York City Model Management · Need assistance?{' '}
                      <a
                        href={`mailto:${CONTACT_CONFIG.directInquiriesEmail}`}
                        className="text-black underline underline-offset-4"
                      >
                        {CONTACT_CONFIG.directInquiriesEmail}
                      </a>
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || uploadBusy}
                    className="px-7 py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {submitting
                        ? 'Saving & Dispatching Confirmation...'
                        : savedRecord
                          ? 'Update Onboarding Profile'
                          : 'Complete Onboarding & Notify Agency'}
                    </span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
