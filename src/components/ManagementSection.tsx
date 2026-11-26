import React, { useState } from 'react';
import { ArrowUpRight, X, CheckCircle2, Lock, CreditCard } from 'lucide-react';
import {
  BOOKING_PACKAGES,
  ELITE_ROSTER,
  EliteDivision,
  EliteModel,
  MEDIA_PRODUCTION_SERVICES,
} from '../data/clubData';
import { EditorialPlate } from './EditorialPlate';
import type { PaymentProvider } from './MembershipSection';

interface ManagementSectionProps {
  onApplyMembership: () => void;
  stripeConfigured?: boolean;
  squareConfigured?: boolean;
  paymentProvider?: PaymentProvider;
  onChangePaymentProvider?: (provider: PaymentProvider) => void;
  isProd?: boolean;
  verifiedBooking?: { reference: string; modelName: string; provider?: PaymentProvider } | null;
  bookingNotice?: string | null;
  approvedRosterModels?: EliteModel[];
  clientAccessUnlocked?: boolean;
  onVerifyClientLogin?: (email: string, memberCode: string) => Promise<string | null>;
  onLogoutClientAccess?: () => void;
}

type FilterDivision = Exclude<EliteDivision, 'All Roster'>;

const DIVISIONS: FilterDivision[] = [
  'Runway',
  'Editorial',
  'Commercial',
  'AI Representation',
];

export const ManagementSection: React.FC<ManagementSectionProps> = ({
  onApplyMembership,
  stripeConfigured = false,
  squareConfigured = false,
  paymentProvider = 'stripe',
  onChangePaymentProvider,
  isProd: _isProd = false,
  verifiedBooking = null,
  bookingNotice = null,
  approvedRosterModels = [],
  clientAccessUnlocked = false,
  onVerifyClientLogin,
  onLogoutClientAccess,
}) => {
  const [localProvider, setLocalProvider] = useState<PaymentProvider>(paymentProvider);
  const activeProvider = onChangePaymentProvider ? paymentProvider : localProvider;
  const setActiveProvider = (provider: PaymentProvider) => {
    setLocalProvider(provider);
    if (onChangePaymentProvider) {
      onChangePaymentProvider(provider);
    }
  };
  const providerLabel = activeProvider === 'square' ? 'Square' : 'Stripe';
  const usesHostedCheckout =
    activeProvider === 'square' ? squareConfigured : stripeConfigured;
  const [selectedDivision, setSelectedDivision] = useState<FilterDivision | null>(null);
  const [activeModel, setActiveModel] = useState<EliteModel | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [clientLoginOpen, setClientLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Online Booking & Payment Modal State (20% Client Fee + 20% Model Commission + Optional Media Bundle)
  const [selectedPkgId, setSelectedPkgId] = useState<string>(BOOKING_PACKAGES[1].id);
  const [bundleMedia, setBundleMedia] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string>(MEDIA_PRODUCTION_SERVICES[3].id);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [paidReceipt, setPaidReceipt] = useState<{
    reference: string;
    totalClientChargeDollars: number;
    baseRateDollars: number;
    productionRateDollars?: number;
    clientFeeDollars: number;
    memberDiscountDollars?: number;
  } | null>(null);

  const combinedRoster = [...approvedRosterModels, ...ELITE_ROSTER].filter(
    (m) =>
      clientAccessUnlocked ||
      (!m.isMinor &&
        m.visibility !== 'clients_only' &&
        m.visibilityScope !== 'verified_clients_only')
  );
  const visibleModels = selectedDivision
    ? combinedRoster.filter((m) => m.division === selectedDivision)
    : combinedRoster;

  const activePackage =
    BOOKING_PACKAGES.find((p) => p.id === selectedPkgId) || BOOKING_PACKAGES[1];
  const activeMediaService =
    MEDIA_PRODUCTION_SERVICES.find((s) => s.id === selectedMediaId) ||
    MEDIA_PRODUCTION_SERVICES[0];

  const baseRate = activePackage.baseRateDollars;
  const productionRate = bundleMedia ? activeMediaService.rateDollars : 0;
  const clientAgencyFee = Math.round(baseRate * 0.2);
  const grossBookingSubtotal = baseRate + clientAgencyFee + productionRate;
  const memberDiscountDollars = clientAccessUnlocked
    ? Math.round(grossBookingSubtotal * 0.15)
    : 0;
  const totalOnlineCharge = Math.max(0, grossBookingSubtotal - memberDiscountDollars);

  const openCompCard = (model: EliteModel) => {
    setActiveModel(model);
    setSelectedPkgId(BOOKING_PACKAGES[1].id);
    setBundleMedia(false);
    setPaidReceipt(null);
    setBookingError(null);
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const handleOnlineBookingPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModel) return;
    setBookingError(null);

    if (!clientName.trim() || !clientEmail.includes('@')) {
      setBookingError('Please enter your brand/agency name and valid email.');
      return;
    }
    if (!usesHostedCheckout) {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 12 || expiry.replace(/\D/g, '').length < 4 || cvc.length < 3) {
        setBookingError('Please enter valid payment card details to authorize online booking.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingScope: bundleMedia ? 'bundle' : 'model',
          paymentProvider: activeProvider,
          modelId: activeModel.id,
          modelName: activeModel.name,
          packageLabel: activePackage.label,
          productionPackage: bundleMedia ? activeMediaService.title : '',
          baseRateDollars: baseRate,
          productionRateDollars: productionRate,
          clientMember: clientAccessUnlocked,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          shootDate: shootDate.trim() || 'Flexible',
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || 'Booking authorization failed.');
        setSubmitting(false);
        return;
      }

      if ((data.mode === 'stripe_redirect' || data.mode === 'square_redirect') && data.url) {
        window.location.assign(data.url);
        return;
      }

      setPaidReceipt({
        reference: data.reference,
        ...data.breakdown,
      });
      setClientName('');
      setClientEmail('');
      setShootDate('');
      setNotes('');
      setCardNumber('');
      setExpiry('');
      setCvc('');
    } catch {
      setBookingError('Network error authorizing online booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="management"
      className="bg-[#0A0A0A] text-white border-t border-neutral-800 py-12 md:py-16"
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        {/* Top Agency Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-800">
          <div className="flex items-baseline gap-3">
            <span className="font-display font-extrabold text-xl tracking-tight text-white">
              nyc model management.
            </span>
            <span className="font-editorial italic text-base text-neutral-400">
              Private Agency Division
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
              Direct Agency Desk · Rates Upon Inquiry / Client Access
            </span>
            {onVerifyClientLogin && !clientAccessUnlocked && (
              <button
                type="button"
                onClick={() => {
                  setLoginError(null);
                  setClientLoginOpen(true);
                }}
                className="font-mono text-[11px] uppercase tracking-wider text-white underline underline-offset-4 hover:text-neutral-300 cursor-pointer"
              >
                Client &amp; Agency Login
              </button>
            )}
          </div>
        </div>

        {/* Hero Agency Manifesto */}
        <div className="pt-8 pb-9 border-b border-neutral-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <h2
              className="font-display font-bold tracking-[-0.03em] text-white leading-[1.04]"
              style={{ fontSize: 'clamp(2.1rem, 4.4vw, 3.5rem)', textWrap: 'balance' }}
            >
              Represented Talent &amp; Direct Booking.
            </h2>
            <p className="mt-3 text-sm text-neutral-300 leading-relaxed max-w-2xl">
              Book curated runway, editorial, commercial, and AI-represented talent through our
              agency desk. Agency rates are shared upon request, with exclusive member discounts for
              Clients &amp; Agencies.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2.5">
            <button
              type="button"
              onClick={onApplyMembership}
              className="px-6 py-2.5 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 transition-colors whitespace-nowrap"
            >
              Get Scouted via Membership
            </button>
            <span className="text-[11px] text-neutral-400">
              Selected directly from active NYC Model Club talent
            </span>
          </div>
        </div>

        {/* Paid Booking Confirmation Banner */}
        {verifiedBooking && (
          <div
            className="mt-8 p-5 border border-white bg-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-white shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
                  {verifiedBooking.provider === 'square' ? 'Square' : 'Stripe'} Online Booking Confirmed
                </p>
                <p className="font-display font-bold text-base text-white mt-0.5">
                  {verifiedBooking.modelName} booked · Reference {verifiedBooking.reference}
                </p>
              </div>
            </div>
            <span className="font-mono text-xs text-neutral-300 tabular-nums">
              Status: Paid via {verifiedBooking.provider === 'square' ? 'Square' : 'Stripe'}
            </span>
          </div>
        )}

        {bookingNotice && !verifiedBooking && (
          <div
            className="mt-8 p-4 border border-neutral-700 bg-neutral-900 text-xs text-neutral-300"
            role="status"
          >
            {bookingNotice}
          </div>
        )}

        {clientAccessUnlocked && (
          <div
            className="mt-8 p-4 border border-white/60 bg-neutral-900 flex flex-wrap items-center justify-between gap-3 text-xs"
            role="status"
          >
            <span className="font-semibold text-white">
              Clients &amp; Agencies Pass Active: Full Verified Roster, Restricted Profiles &amp; Rate Desk Unlocked
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-300">
                15% Client Member Discount Applied
              </span>
              {onLogoutClientAccess && (
                <button
                  type="button"
                  onClick={onLogoutClientAccess}
                  className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 underline underline-offset-4 hover:text-white cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}

        {/* Division Filter Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-900 border border-neutral-800">
            {DIVISIONS.map((div) => {
              const active = selectedDivision === div;
              return (
                <button
                  key={div}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedDivision((prev) => (prev === div ? null : div))
                  }
                  className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {div}
                </button>
              );
            })}
          </div>
          <span className="font-mono text-xs text-neutral-400 tabular-nums">
            {visibleModels.length} Represented Talent · Instant Online Booking
          </span>
        </div>

        {/* Pioneering AI Model Representation Callout */}
        <div className="mt-6 p-5 border border-neutral-800 bg-neutral-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
              Pioneering Division · AI Model Representation
            </p>
            <p className="mt-1 text-xs md:text-sm text-neutral-200 leading-relaxed">
              NYC Model Club is one of{' '}
              <strong className="text-white font-semibold">
                the first New York agencies to represent AI talent
              </strong>
              , offering licensed digital models alongside our main editorial and runway roster.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSelectedDivision((prev) =>
                prev === 'AI Representation' ? null : 'AI Representation'
              )
            }
            className="px-4 py-2 border border-neutral-600 text-xs font-semibold uppercase tracking-wider text-white hover:border-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {selectedDivision === 'AI Representation'
              ? 'Show Full Roster'
              : 'View AI Model Roster'}
          </button>
        </div>

        {/* Represented Models Grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {visibleModels.map((model) => (
            <article key={model.id} className="group flex flex-col">
              <button
                type="button"
                onClick={() => openCompCard(model)}
                className="text-left focus-visible:outline-2 focus-visible:outline-white"
              >
                <div className="relative aspect-[3/4] overflow-hidden border border-neutral-800 bg-neutral-950">
                  {model.imageSrc && !failedImages[model.id] ? (
                    <img
                      src={model.imageSrc}
                      alt={`${model.name}, New York City Model Management`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [model.id]: true }))
                      }
                      className="w-full h-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <EditorialPlate
                      variant={model.plateVariant}
                      darkSurface
                      className="w-full h-full transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                      label={`${model.name}, New York City Model Management`}
                    />
                  )}
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/85 border border-neutral-700 text-[10px] font-mono uppercase tracking-wider text-white flex items-center gap-1">
                    <span>Book Online</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="pt-4 flex items-baseline justify-between gap-4 border-b border-neutral-800 pb-2.5">
                  <h3 className="font-display font-bold text-xl tracking-tight text-white">
                    {model.name}
                  </h3>
                  <span className="font-mono text-xs text-neutral-300 tabular-nums shrink-0">
                    {clientAccessUnlocked
                      ? `$${Math.round(model.dayRateDollars * 0.85).toLocaleString()} / day · Member`
                      : 'Rates on Inquiry'}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 text-xs text-neutral-400">
                  <span>
                    {model.division} · {model.height} · {model.location}
                  </span>
                  <span className="font-mono tabular-nums">{model.plateCode}</span>
                </div>

                {model.aiTalent && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-300">
                    AI Model Representation · Digital Campaign Licensing
                  </p>
                )}

                {(model.isMinor ||
                  model.visibility === 'clients_only' ||
                  model.visibilityScope === 'verified_clients_only') && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-300">
                    Private Minor Profile · Verified Clients &amp; Agencies Only
                  </p>
                )}

                <p className="mt-1 text-xs text-neutral-500 truncate">
                  {model.clients.join(' · ')}
                </p>
              </button>
            </article>
          ))}
        </div>
      </div>

      {/* Comp Card + Online Booking & 20%/20% Commission Payment Modal */}
      {activeModel && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mgmt-booking-title"
        >
          <div className="bg-[#0c0c0c] text-white border border-neutral-700 w-full max-w-5xl max-h-[92vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
            {/* Left Portrait & Measurements */}
            <div className="lg:col-span-5 bg-black border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col">
              <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-950">
                {activeModel.imageSrc && !failedImages[activeModel.id] ? (
                  <img
                    src={activeModel.imageSrc}
                    alt={`${activeModel.name} comp card`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [activeModel.id]: true }))
                    }
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <EditorialPlate
                    variant={activeModel.plateVariant}
                    darkSurface
                    className="w-full h-full"
                    label={`${activeModel.name} comp card`}
                  />
                )}
              </div>
              <div className="p-6 border-t border-neutral-800 space-y-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
                    {activeModel.plateCode} · {activeModel.aiTalent ? 'AI Model Representation' : 'New York City Model Management'}
                  </p>
                  <h3 id="mgmt-booking-title" className="font-display font-bold text-2xl mt-1">
                    {activeModel.name}
                  </h3>
                  {activeModel.licensingTerms && (
                    <p className="mt-1 font-mono text-[11px] text-neutral-400">
                      {activeModel.licensingTerms}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-neutral-300 leading-relaxed">{activeModel.bio}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-800 text-xs">
                  <div>
                    <span className="block text-neutral-500">Height</span>
                    <span className="font-mono text-white tabular-nums">{activeModel.height}</span>
                  </div>
                  <div>
                    <span className="block text-neutral-500">Stats</span>
                    <span className="font-mono text-white tabular-nums">
                      {activeModel.measurements}
                    </span>
                  </div>
                  <div>
                    <span className="block text-neutral-500">Shoe</span>
                    <span className="font-mono text-white tabular-nums">{activeModel.shoe}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Online Booking & 20% Client + 20% Model Commission Payment */}
            <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-neutral-800">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
                    Direct Online Booking &amp; Payment
                  </p>
                  <h4 className="font-display font-bold text-xl mt-1">
                    Book {activeModel.name} Online
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModel(null)}
                  aria-label="Close booking dialog"
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {paidReceipt ? (
                <div className="my-auto py-8">
                  <div className="p-6 border border-neutral-700 bg-neutral-900/70 space-y-4">
                    <div className="flex items-center gap-2.5 text-white font-semibold text-base">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Booking Confirmed &amp; Paid ({paidReceipt.reference})</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      New York City Model Management has locked {activeModel.name} for your
                      selected production date. Call sheet and release forms have been sent.
                    </p>
                    <div className="pt-4 border-t border-neutral-800 space-y-2 text-xs font-mono tabular-nums">
                      <div className="flex justify-between text-neutral-400">
                        <span>Talent Booking Package</span>
                        <span>${paidReceipt.baseRateDollars.toLocaleString()}.00</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Agency Booking &amp; Coordination</span>
                        <span>+${paidReceipt.clientFeeDollars.toLocaleString()}.00</span>
                      </div>
                      {Boolean(paidReceipt.productionRateDollars) && (
                        <div className="flex justify-between text-neutral-400">
                          <span>Media &amp; Visual Works Bundle</span>
                          <span>
                            +${(paidReceipt.productionRateDollars || 0).toLocaleString()}.00
                          </span>
                        </div>
                      )}
                      {Boolean(paidReceipt.memberDiscountDollars) && (
                        <div className="flex justify-between text-neutral-300">
                          <span>Clients &amp; Agencies Member Discount (15%)</span>
                          <span>
                            -${(paidReceipt.memberDiscountDollars || 0).toLocaleString()}.00
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-white font-semibold pt-2 border-t border-neutral-800">
                        <span>Total Paid Online</span>
                        <span>${paidReceipt.totalClientChargeDollars.toLocaleString()}.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOnlineBookingPayment} className="mt-5 space-y-5">
                  {/* Package Selector */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                      1. Select Booking Package
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {BOOKING_PACKAGES.map((pkg) => {
                        const active = pkg.id === selectedPkgId;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedPkgId(pkg.id)}
                            className={`p-3 text-left border transition-colors ${
                              active
                                ? 'border-white bg-neutral-900 text-white'
                                : 'border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600'
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold text-white">{pkg.label}</span>
                              <span className="font-mono text-xs tabular-nums text-white">
                                ${pkg.baseRateDollars.toLocaleString()}
                              </span>
                            </div>
                            <span className="block text-[11px] text-neutral-500 mt-0.5">
                              {pkg.duration}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Division Bundling: Model Only vs Bundle with Media & Visual Works */}
                  <div className="space-y-2.5">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      2. Division Scope (Optional Media Production Bundle)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBundleMedia(false)}
                        className={`py-2 px-3 text-xs font-semibold border transition-colors cursor-pointer ${
                          !bundleMedia
                            ? 'border-white bg-white text-black'
                            : 'border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600'
                        }`}
                      >
                        Model Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setBundleMedia(true)}
                        className={`py-2 px-3 text-xs font-semibold border transition-colors cursor-pointer ${
                          bundleMedia
                            ? 'border-white bg-white text-black'
                            : 'border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600'
                        }`}
                      >
                        Bundle + Media Production
                      </button>
                    </div>
                    {bundleMedia && (
                      <select
                        value={selectedMediaId}
                        onChange={(e) => setSelectedMediaId(e.target.value)}
                        aria-label="Select Media & Visual Works production package"
                        className="w-full px-3 py-2.5 bg-black border border-neutral-700 text-xs text-white focus:border-white focus:outline-none"
                      >
                        {MEDIA_PRODUCTION_SERVICES.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.category}: {svc.title} (+${svc.rateDollars.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Client Booking Rate Summary */}
                  <div className="p-4 border border-neutral-800 bg-neutral-950 space-y-2 text-xs">
                    <div className="flex justify-between text-neutral-300">
                      <span>Talent Package ({activePackage.label})</span>
                      <span className="font-mono tabular-nums">${baseRate.toLocaleString()}.00</span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Agency Booking &amp; Coordination</span>
                      <span className="font-mono tabular-nums">
                        +${clientAgencyFee.toLocaleString()}.00
                      </span>
                    </div>
                    {bundleMedia && (
                      <div className="flex justify-between text-neutral-300">
                        <span>Media &amp; Visual Works ({activeMediaService.title})</span>
                        <span className="font-mono tabular-nums">
                          +${productionRate.toLocaleString()}.00
                        </span>
                      </div>
                    )}
                    {clientAccessUnlocked && memberDiscountDollars > 0 && (
                      <div className="flex justify-between text-neutral-200">
                        <span>Clients &amp; Agencies Member Discount (-15%)</span>
                        <span className="font-mono tabular-nums">
                          -${memberDiscountDollars.toLocaleString()}.00
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-white font-semibold text-sm pt-2 border-t border-neutral-800">
                      <span>Total Online Payment Due</span>
                      <span className="font-mono tabular-nums">
                        ${totalOnlineCharge.toLocaleString()}.00
                      </span>
                    </div>
                    {!clientAccessUnlocked && (
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
                        <span>
                          Clients &amp; Agencies ($99/mo) members save 15% on all talent bookings.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModel(null);
                            onApplyMembership();
                          }}
                          className="text-white underline underline-offset-4 hover:text-neutral-300 cursor-pointer"
                        >
                          Unlock Member Discount
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Client & Production Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Brand / Casting Director"
                      className="px-3 py-2.5 bg-black border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
                    />
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="production@brand.com"
                      className="px-3 py-2.5 bg-black border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={shootDate}
                      onChange={(e) => setShootDate(e.target.value)}
                      placeholder="Shoot date(s) e.g. Dec 12, 2026"
                      className="px-3 py-2.5 bg-black border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Studio / usage notes"
                      className="px-3 py-2.5 bg-black border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
                    />
                  </div>

                  {/* Payment Provider Selector */}
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                      3. Payment Method
                    </span>
                    <div
                      className="grid grid-cols-2 border border-neutral-800 bg-black p-0.5"
                      role="group"
                      aria-label="Payment method"
                    >
                      <button
                        type="button"
                        aria-pressed={activeProvider === 'stripe'}
                        onClick={() => setActiveProvider('stripe')}
                        className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
                          activeProvider === 'stripe'
                            ? 'bg-white text-black'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Pay with Stripe
                      </button>
                      <button
                        type="button"
                        aria-pressed={activeProvider === 'square'}
                        onClick={() => setActiveProvider('square')}
                        className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
                          activeProvider === 'square'
                            ? 'bg-white text-black'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Pay with Square
                      </button>
                    </div>
                  </div>

                  {/* Online Card Authorization (Test preview only when Hosted Checkout is not active) */}
                  {!usesHostedCheckout && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                        Online Payment via {providerLabel} (Test Preview)
                      </label>
                      <div className="border border-neutral-700 bg-black focus-within:border-white">
                        <div className="flex items-center px-3.5 py-2.5 border-b border-neutral-800">
                          <CreditCard className="w-4 h-4 text-neutral-500 mr-2.5 shrink-0" />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="1234 5678 9012 3456"
                            className="w-full bg-transparent text-xs font-mono tabular-nums text-white placeholder:text-neutral-600 focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-neutral-800">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={expiry}
                            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                            placeholder="MM/YY"
                            className="px-3.5 py-2.5 bg-transparent text-xs font-mono tabular-nums text-white placeholder:text-neutral-600 focus:outline-none"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="CVC"
                            className="px-3.5 py-2.5 bg-transparent text-xs font-mono tabular-nums text-white placeholder:text-neutral-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {bookingError && (
                    <p className="text-xs text-red-400" role="alert">
                      {bookingError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {submitting
                        ? usesHostedCheckout
                          ? `Redirecting to ${providerLabel} Checkout...`
                          : `Authorizing via ${providerLabel}...`
                        : usesHostedCheckout
                          ? `Continue to ${providerLabel} Checkout ($${totalOnlineCharge.toLocaleString()}.00)`
                          : `Pay $${totalOnlineCharge.toLocaleString()}.00 via ${providerLabel} & Confirm`}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verified Client & Agency Sign-In Modal */}
      {clientLoginOpen && onVerifyClientLogin && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-login-title"
        >
          <div className="bg-[#0c0c0c] text-white border border-neutral-700 w-full max-w-md p-7 relative">
            <button
              type="button"
              onClick={() => setClientLoginOpen(false)}
              aria-label="Close client sign-in"
              className="absolute top-5 right-5 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
              Verified Clients &amp; Agencies Access
            </p>
            <h3 id="client-login-title" className="font-display font-bold text-2xl mt-1">
              Sign In with Client Pass
            </h3>
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
              Enter your active Clients &amp; Agencies membership email and pass code to view
              restricted minor profiles, private roster listings, and 15% member booking rates.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginError(null);
                setLoginBusy(true);
                const err = await onVerifyClientLogin(loginEmail, loginCode);
                setLoginBusy(false);
                if (err) {
                  setLoginError(err);
                  return;
                }
                setClientLoginOpen(false);
                setLoginEmail('');
                setLoginCode('');
              }}
              className="mt-5 space-y-3.5"
            >
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Client / Agency Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="casting@agency.com"
                  className="w-full px-3 py-2 bg-black border border-neutral-700 text-xs text-white placeholder:text-neutral-600 focus:border-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Member Pass Code
                </label>
                <input
                  type="text"
                  required
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="NYCMC-XXXX"
                  className="w-full px-3 py-2 bg-black border border-neutral-700 text-xs font-mono uppercase text-white placeholder:text-neutral-600 focus:border-white focus:outline-none"
                />
              </div>
              {loginError && (
                <p className="text-xs text-red-400" role="alert">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                disabled={loginBusy}
                className="w-full py-3 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loginBusy ? 'Verifying Pass...' : 'Unlock Verified Client View'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
