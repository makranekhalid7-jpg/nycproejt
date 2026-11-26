import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, CreditCard, Lock, X } from 'lucide-react';
import {
  BOOKING_PACKAGES,
  CONTACT_CONFIG,
  ELITE_ROSTER,
  MEDIA_PRODUCTION_SERVICES,
  MediaProductionService,
} from '../data/clubData';
import type { PaymentProvider } from './MembershipSection';

interface MediaProductionSectionProps {
  stripeConfigured?: boolean;
  squareConfigured?: boolean;
  paymentProvider?: PaymentProvider;
  onChangePaymentProvider?: (provider: PaymentProvider) => void;
  isProd?: boolean;
  clientAccessUnlocked?: boolean;
  onUnlockClientAccess?: () => void;
}

type BookingScope = 'model' | 'production' | 'bundle';

export const MediaProductionSection: React.FC<MediaProductionSectionProps> = ({
  stripeConfigured = false,
  squareConfigured = false,
  paymentProvider = 'stripe',
  onChangePaymentProvider,
  isProd: _isProd = false,
  clientAccessUnlocked = false,
  onUnlockClientAccess,
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

  const [modalOpen, setModalOpen] = useState(false);
  const [bookingScope, setBookingScope] = useState<BookingScope>('production');
  const [selectedModelId, setSelectedModelId] = useState<string>(ELITE_ROSTER[0].id);
  const [selectedModelPkgId, setSelectedModelPkgId] = useState<string>(BOOKING_PACKAGES[1].id);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    MEDIA_PRODUCTION_SERVICES[3].id
  );

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
    bookingScope: BookingScope;
    baseRateDollars: number;
    productionRateDollars: number;
    clientFeeDollars: number;
    memberDiscountDollars?: number;
    totalClientChargeDollars: number;
  } | null>(null);

  const selectedModel =
    ELITE_ROSTER.find((m) => m.id === selectedModelId) || ELITE_ROSTER[0];
  const selectedModelPackage =
    BOOKING_PACKAGES.find((p) => p.id === selectedModelPkgId) || BOOKING_PACKAGES[1];
  const selectedService =
    MEDIA_PRODUCTION_SERVICES.find((s) => s.id === selectedServiceId) ||
    MEDIA_PRODUCTION_SERVICES[0];

  const includesModel = bookingScope === 'model' || bookingScope === 'bundle';
  const includesProduction = bookingScope === 'production' || bookingScope === 'bundle';

  const modelRate = includesModel ? selectedModelPackage.baseRateDollars : 0;
  const productionRate = includesProduction ? selectedService.rateDollars : 0;
  const clientAgencyFee = includesModel ? Math.round(modelRate * 0.2) : 0;
  const grossBookingSubtotal = modelRate + clientAgencyFee + productionRate;
  const memberDiscountDollars = clientAccessUnlocked
    ? Math.round(grossBookingSubtotal * 0.15)
    : 0;
  const totalOnlineCharge = Math.max(0, grossBookingSubtotal - memberDiscountDollars);

  const openBookingDesk = (
    scope: BookingScope,
    service?: MediaProductionService
  ) => {
    setBookingScope(scope);
    if (service) {
      setSelectedServiceId(service.id);
    }
    setPaidReceipt(null);
    setBookingError(null);
    setModalOpen(true);
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

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!clientName.trim() || !clientEmail.includes('@')) {
      setBookingError('Please enter your brand/agency name and a valid business email.');
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
          bookingScope,
          paymentProvider: activeProvider,
          modelId: includesModel ? selectedModel.id : 'media-only',
          modelName: includesModel ? selectedModel.name : 'Media & Visual Works Only',
          packageLabel: includesModel
            ? selectedModelPackage.label
            : selectedService.title,
          productionPackage: includesProduction ? selectedService.title : '',
          baseRateDollars: modelRate,
          productionRateDollars: productionRate,
          clientMember: clientAccessUnlocked,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          shootDate: shootDate.trim() || 'Flexible',
          notes: notes.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mode?: string;
        url?: string;
        reference?: string;
        error?: string;
        breakdown?: {
          bookingScope: BookingScope;
          baseRateDollars: number;
          productionRateDollars: number;
          clientFeeDollars: number;
          memberDiscountDollars?: number;
          totalClientChargeDollars: number;
        };
      };

      if (!res.ok) {
        setBookingError(data.error || 'Booking authorization failed.');
        return;
      }

      if ((data.mode === 'stripe_redirect' || data.mode === 'square_redirect') && data.url) {
        window.location.assign(data.url);
        return;
      }

      if (data.breakdown) {
        setPaidReceipt({
          reference: data.reference || 'NYCMM',
          ...data.breakdown,
        });
      }
      setClientName('');
      setClientEmail('');
      setShootDate('');
      setNotes('');
      setCardNumber('');
      setExpiry('');
      setCvc('');
    } catch {
      setBookingError('Network error authorizing production booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="media-production"
      className="bg-white text-black border-t border-neutral-200 py-12 md:py-16"
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        {/* Editorial Division Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-neutral-200">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-1.5">
              Division 02 · Media &amp; Visual Works
            </p>
            <h2
              className="font-editorial italic font-normal tracking-[-0.02em] text-black leading-[1.03]"
              style={{ fontSize: 'clamp(2.1rem, 4vw, 3.25rem)' }}
            >
              Media &amp; Visual Works.
            </h2>
            <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed max-w-xl">
              Photography, film &amp; motion, art direction, and lookbook production, booked
              standalone as <strong className="font-semibold text-black">Media Only</strong> or{' '}
              <strong className="font-semibold text-black">bundled with represented models</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openBookingDesk('bundle')}
              className="px-5 py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              Bundle Models + Media
            </button>
            <button
              type="button"
              onClick={() => openBookingDesk('production')}
              className="px-5 py-3 border border-black text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              Book Media Only
            </button>
          </div>
        </div>

        {/* Services Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <span className="px-3.5 py-1.5 bg-black text-white text-xs font-medium tracking-wide whitespace-nowrap">
            All Services
          </span>
          <span className="font-mono text-xs text-neutral-500 tabular-nums">
            {clientAccessUnlocked
              ? `${MEDIA_PRODUCTION_SERVICES.length} Units · 15% Client Member Discount Active`
              : 'Rates available via Booking Desk · 15% Off for Client Members'}
          </span>
        </div>

        {/* 2x2 Architectural Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 border border-neutral-200 divide-y md:divide-y-0 md:grid-flow-row">
          {MEDIA_PRODUCTION_SERVICES.map((service, index) => (
            <article
              key={service.id}
              className={`p-7 md:p-9 flex flex-col justify-between bg-white ${
                index % 2 === 0 ? 'md:border-r md:border-neutral-200' : ''
              } ${index >= 2 ? 'md:border-t md:border-neutral-200' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-200 text-[11px] font-mono uppercase tracking-[0.14em] text-neutral-500">
                  <span>
                    {service.indexLabel} · {service.category}
                  </span>
                  <span>{service.turnaround}</span>
                </div>

                <div className="mt-5 flex items-baseline justify-between gap-3">
                  <h3 className="font-display font-bold text-lg xl:text-[19px] tracking-[-0.025em] leading-snug text-black min-w-0">
                    {service.title}
                  </h3>
                  {clientAccessUnlocked && (
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] font-semibold text-neutral-700 tabular-nums shrink-0 whitespace-nowrap">
                      ${Math.round(service.rateDollars * 0.85).toLocaleString()} · Member
                    </span>
                  )}
                </div>

                {service.exampleNote && (
                  <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-600">
                    {service.exampleNote}
                  </p>
                )}

                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">{service.summary}</p>

                <ul className="mt-5 space-y-2 text-xs text-neutral-700">
                  {service.deliverables.map((item) => {
                    const colonIdx = item.indexOf(':');
                    const hasPrefix = colonIdx > 0 && colonIdx < 22;
                    return (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          {hasPrefix ? (
                            <>
                              <strong className="font-semibold text-black">
                                {item.slice(0, colonIdx + 1)}
                              </strong>
                              {item.slice(colonIdx + 1)}
                            </>
                          ) : (
                            item
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-8 pt-5 border-t border-neutral-200 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openBookingDesk('production', service)}
                  className="px-4 py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Book Production Only</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => openBookingDesk('bundle', service)}
                  className="px-4 py-2.5 border border-black text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Bundle with Model
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Custom Projects / Custom Quote Option */}
        <div className="border-x border-b border-neutral-200 bg-neutral-50 p-7 md:p-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              05 · Bespoke Production Scope
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="font-display font-bold text-xl md:text-2xl tracking-tight text-black">
                Bigger Scale? Let&rsquo;s Build It
              </h3>
              <span className="font-mono text-xs uppercase tracking-wider font-semibold text-neutral-700 shrink-0">
                Custom Quote
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Launching 25+ looks, booking multiple shoot days, or pairing models with full media
              production? Reach out and we&rsquo;ll price a custom package for your drop.
            </p>
            <p className="mt-2.5 font-mono text-[11px] text-neutral-500">
              Custom shot lists · Multi-day bookings · Full usage options · Dedicated edit schedule
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={`mailto:${CONTACT_CONFIG.directInquiriesEmail}?subject=${encodeURIComponent(
                'Custom Media & Visual Works Quote | NYC Model Club'
              )}`}
              className="px-5 py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Request Custom Quote</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => openBookingDesk('bundle')}
              className="px-5 py-3 border border-black text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              Configure Custom Bundle
            </button>
          </div>
        </div>
      </div>

      {/* Unified Booking Modal: Models Only | Media Production Only | Bundle Models + Media */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-booking-title"
        >
          <div className="bg-white text-black border border-black w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 bg-black text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span className="font-mono text-xs uppercase tracking-wider">
                  NYC Model Club · Production &amp; Roster Booking Desk
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close booking desk"
                className="p-1 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paidReceipt ? (
              <div className="p-8 md:p-10 space-y-5">
                <div className="flex items-center gap-2.5 text-black font-semibold text-lg">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  <span>Booking Confirmed ({paidReceipt.reference})</span>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {paidReceipt.bookingScope === 'production'
                    ? `Media & Visual Works package "${selectedService.title}" is scheduled.`
                    : paidReceipt.bookingScope === 'bundle'
                      ? `Integrated bundle (${selectedModel.name} + ${selectedService.title}) is scheduled.`
                      : `Model booking for ${selectedModel.name} is confirmed.`}
                </p>

                <div className="p-4 border border-neutral-200 bg-neutral-50 space-y-2 text-xs font-mono tabular-nums">
                  {paidReceipt.baseRateDollars > 0 && (
                    <>
                      <div className="flex justify-between text-neutral-600">
                        <span>Talent Booking Package</span>
                        <span>${paidReceipt.baseRateDollars.toLocaleString()}.00</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Agency Booking &amp; Coordination</span>
                        <span>+${paidReceipt.clientFeeDollars.toLocaleString()}.00</span>
                      </div>
                    </>
                  )}
                  {paidReceipt.productionRateDollars > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Media &amp; Visual Works Production</span>
                      <span>${paidReceipt.productionRateDollars.toLocaleString()}.00</span>
                    </div>
                  )}
                  {Boolean(paidReceipt.memberDiscountDollars) && (
                    <div className="flex justify-between text-black font-medium">
                      <span>Clients &amp; Agencies Member Discount (15%)</span>
                      <span>-${(paidReceipt.memberDiscountDollars || 0).toLocaleString()}.00</span>
                    </div>
                  )}
                  <div className="flex justify-between text-black font-semibold pt-2 border-t border-neutral-200">
                    <span>Total Paid Online</span>
                    <span>${paidReceipt.totalClientChargeDollars.toLocaleString()}.00</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitBooking} className="p-6 md:p-8 space-y-5">
                <div>
                  <h3 id="media-booking-title" className="font-display font-bold text-2xl">
                    Configure Your Booking
                  </h3>
                  <p className="text-xs text-neutral-600 mt-1">
                    Choose whether to book represented models independently, Media &amp; Visual
                    Works independently, or both divisions together in one production checkout.
                  </p>
                </div>

                {/* 3-Way Scope Switcher */}
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
                    1. Booking Scope
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'model', label: 'Models Only' },
                        { id: 'production', label: 'Media Production Only' },
                        { id: 'bundle', label: 'Bundle: Models + Media' },
                      ] as const
                    ).map((opt) => {
                      const active = bookingScope === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setBookingScope(opt.id)}
                          className={`py-2.5 px-3 text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-black text-white border-black'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model Selection */}
                {includesModel && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Represented Model
                      </label>
                      <select
                        value={selectedModelId}
                        onChange={(e) => setSelectedModelId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white focus:border-black focus:outline-none"
                      >
                        {ELITE_ROSTER.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.division})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Model Booking Package
                      </label>
                      <select
                        value={selectedModelPkgId}
                        onChange={(e) => setSelectedModelPkgId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white focus:border-black focus:outline-none"
                      >
                        {BOOKING_PACKAGES.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.label} (${pkg.baseRateDollars.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Media Production Selection */}
                {includesProduction && (
                  <div className="pt-2 border-t border-neutral-200">
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Media &amp; Visual Works Package
                    </label>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white focus:border-black focus:outline-none"
                    >
                      {MEDIA_PRODUCTION_SERVICES.map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.category}: {svc.title} (${svc.rateDollars.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Breakdown Summary */}
                <div className="p-4 border border-neutral-200 bg-neutral-50 space-y-2 text-xs font-mono tabular-nums">
                  {includesModel && (
                    <>
                      <div className="flex justify-between text-neutral-700">
                        <span>
                          Talent Package ({selectedModel.name} · {selectedModelPackage.label})
                        </span>
                        <span>${modelRate.toLocaleString()}.00</span>
                      </div>
                      <div className="flex justify-between text-neutral-700">
                        <span>Agency Booking &amp; Coordination</span>
                        <span>+${clientAgencyFee.toLocaleString()}.00</span>
                      </div>
                    </>
                  )}
                  {includesProduction && (
                    <div className="flex justify-between text-neutral-700">
                      <span>Media Production ({selectedService.title})</span>
                      <span>${productionRate.toLocaleString()}.00</span>
                    </div>
                  )}
                  {clientAccessUnlocked && memberDiscountDollars > 0 && (
                    <div className="flex justify-between text-black font-medium">
                      <span>Clients &amp; Agencies Member Discount (-15%)</span>
                      <span>-${memberDiscountDollars.toLocaleString()}.00</span>
                    </div>
                  )}
                  <div className="flex justify-between text-black font-semibold text-sm pt-2 border-t border-neutral-300">
                    <span>Total Online Checkout Due</span>
                    <span>${totalOnlineCharge.toLocaleString()}.00</span>
                  </div>
                  {!clientAccessUnlocked && (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans text-neutral-600">
                      <span>
                        Clients &amp; Agencies ($99/mo) members save 15% on talent &amp; media
                        bookings.
                      </span>
                      {onUnlockClientAccess && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalOpen(false);
                            onUnlockClientAccess();
                          }}
                          className="font-semibold text-black underline underline-offset-4 hover:text-neutral-600 cursor-pointer"
                        >
                          Unlock Member Discount
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Client Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Brand / Agency Name"
                    className="px-3 py-2 text-xs border border-neutral-300 focus:border-black focus:outline-none"
                  />
                  <input
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="production@brand.com"
                    className="px-3 py-2 text-xs border border-neutral-300 focus:border-black focus:outline-none"
                  />
                  <input
                    type="text"
                    value={shootDate}
                    onChange={(e) => setShootDate(e.target.value)}
                    placeholder="Preferred shoot date(s)"
                    className="px-3 py-2 text-xs border border-neutral-300 focus:border-black focus:outline-none"
                  />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Creative brief / shoot notes"
                    className="px-3 py-2 text-xs border border-neutral-300 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
                    2. Payment Method
                  </span>
                  <div
                    className="grid grid-cols-2 border border-neutral-300 bg-neutral-100 p-0.5"
                    role="group"
                    aria-label="Payment method"
                  >
                    <button
                      type="button"
                      aria-pressed={activeProvider === 'stripe'}
                      onClick={() => setActiveProvider('stripe')}
                      className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        activeProvider === 'stripe'
                          ? 'bg-black text-white'
                          : 'text-neutral-600 hover:text-black'
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
                          ? 'bg-black text-white'
                          : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      Pay with Square
                    </button>
                  </div>
                </div>

                {!usesHostedCheckout && (
                  <div className="border border-neutral-300 focus-within:border-black">
                    <div className="flex items-center px-3.5 py-2.5 border-b border-neutral-200">
                      <CreditCard className="w-4 h-4 text-neutral-400 mr-2.5 shrink-0" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder={`Card number (${providerLabel} test preview)`}
                        className="w-full text-xs font-mono tabular-nums focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-neutral-200">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        className="px-3.5 py-2 text-xs font-mono tabular-nums focus:outline-none"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="CVC"
                        className="px-3.5 py-2 text-xs font-mono tabular-nums focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {bookingError && (
                  <p className="text-xs text-red-600 font-medium" role="alert">
                    {bookingError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submitting
                    ? usesHostedCheckout
                      ? `Redirecting to ${providerLabel} Checkout...`
                      : `Authorizing via ${providerLabel}...`
                    : usesHostedCheckout
                      ? `Continue to ${providerLabel} ($${totalOnlineCharge.toLocaleString()}.00)`
                      : `Confirm & Pay $${totalOnlineCharge.toLocaleString()}.00 via ${providerLabel}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
