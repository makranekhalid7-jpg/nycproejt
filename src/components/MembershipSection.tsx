import React, { useState } from 'react';
import { Check, Lock, ArrowRight } from 'lucide-react';
import { MEMBERSHIP_TIERS, MembershipTier } from '../data/clubData';

export type PaymentProvider = 'stripe' | 'square';

interface MembershipSectionProps {
  onSelectStripePlan: (
    tier: MembershipTier,
    billingCycle: 'monthly' | 'annual',
    paymentProvider?: PaymentProvider
  ) => void;
  paymentProvider?: PaymentProvider;
  onChangePaymentProvider?: (provider: PaymentProvider) => void;
  activeMemberBadge: { planName: string; memberCode: string } | null;
  loadingTierId?: string | null;
  checkoutNotice?: { tone: 'success' | 'info' | 'error'; message: string } | null;
  checkoutError?: string | null;
  errorTierId?: string | null;
  onOpenOnboarding?: () => void;
}

export const MembershipSection: React.FC<MembershipSectionProps> = ({
  onSelectStripePlan,
  activeMemberBadge,
  loadingTierId = null,
  checkoutNotice = null,
  checkoutError = null,
  errorTierId = null,
  onOpenOnboarding,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <section
      id="membership"
      className="bg-white text-black border-t border-neutral-200 py-12 md:py-16"
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        {/* Editorial Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-neutral-200">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-neutral-500 mb-1.5">
              Open to All Models · Club Access &amp; Membership
            </p>
            <h2
              className="font-editorial font-normal italic tracking-[-0.02em] text-black leading-[1.02]"
              style={{ fontSize: 'clamp(2.1rem, 4vw, 3.25rem)' }}
            >
              Membership &amp; Access.
            </h2>
            <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed max-w-xl">
              Open to All Models — three access tiers for talent, studio members, and casting
              clients with instant activation.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            {/* Billing Interval Toggle */}
            <div
              className="inline-flex items-center p-1 border border-neutral-300 bg-neutral-100"
              role="group"
              aria-label="Billing interval"
            >
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-black text-white'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-black text-white'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>

            <span className="text-[11px] text-neutral-500">
              {billingCycle === 'annual'
                ? 'Billed annually · Cancel anytime'
                : 'Billed monthly · Cancel anytime'}
            </span>
          </div>
        </div>

        {/* Pre-Sale / Early Bird Launch Pricing News Ticker (Marquee) */}
        <div
          className="mt-6 border border-black bg-neutral-50 overflow-hidden w-full select-none"
          role="note"
          aria-label="Pre-sale and early bird membership pricing announcement"
        >
          <div className="flex w-max items-center py-3 animate-marquee hover:[animation-play-state:paused]">
            {[0, 1].map((trackIdx) => (
              <div
                key={trackIdx}
                aria-hidden={trackIdx === 1}
                className="flex shrink-0 items-center"
              >
                {[0, 1].map((repeatIdx) => (
                  <div
                    key={repeatIdx}
                    className="flex shrink-0 items-center gap-4 pr-4 whitespace-nowrap"
                  >
                    <span className="px-2.5 py-1 bg-black text-white font-mono text-[10px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap">
                      Discounted Pre-Sale / Early Bird Prices
                    </span>
                    <span className="text-neutral-400 font-mono text-xs" aria-hidden="true">
                      —
                    </span>
                    <span className="text-xs font-medium text-black">
                      Regular membership starts at $35/month starting February 2027.
                    </span>
                    <span className="text-neutral-400 font-mono text-xs" aria-hidden="true">
                      •
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Active Confirmation / Checkout Notice Banner */}
        {activeMemberBadge && (
          <div className="mt-6 p-5 border border-black bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-neutral-500">
                Active Access Confirmed
              </p>
              <p className="font-display font-bold text-base text-black mt-0.5">
                {activeMemberBadge.planName} · Pass {activeMemberBadge.memberCode}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-neutral-700 tabular-nums">
                Status: Active Member
              </span>
              {onOpenOnboarding && (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Open Onboarding Desk
                </button>
              )}
            </div>
          </div>
        )}

        {(checkoutError || (checkoutNotice && (!activeMemberBadge || checkoutNotice.tone === 'error'))) && (
          <div
            className={`mt-6 p-4 border text-xs font-medium ${
              checkoutError || checkoutNotice?.tone === 'error'
                ? 'border-red-600 text-red-700 bg-red-50'
                : 'border-neutral-300 text-neutral-700 bg-neutral-50'
            }`}
            role={checkoutError || checkoutNotice?.tone === 'error' ? 'alert' : 'status'}
          >
            {checkoutError || checkoutNotice?.message}
          </div>
        )}

        {/* 3-Column Architectural Editorial Grid */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 border border-neutral-200 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200">
          {MEMBERSHIP_TIERS.map((tier) => {
            const displayPrice =
              billingCycle === 'annual' ? tier.annualMonthlyPrice : tier.monthlyPrice;
            const isHighlighted = Boolean(tier.highlighted);

            return (
              <article
                key={tier.id}
                className={`p-7 xl:p-9 flex flex-col justify-between ${
                  isHighlighted ? 'bg-[#0A0A0A] text-white' : 'bg-white text-black'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-current/15 mb-6">
                    <span
                      className={`font-mono text-[11px] font-semibold tracking-[0.16em] uppercase ${
                        isHighlighted ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      {tier.indexLabel} · {tier.kicker}
                    </span>
                  </div>

                  <h3 className="font-editorial font-normal italic text-2xl xl:text-[1.75rem] leading-tight">
                    {tier.name}
                  </h3>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display font-bold text-4xl xl:text-[2.75rem] tracking-tight tabular-nums">
                      ${displayPrice}
                    </span>
                    <span
                      className={`text-xs uppercase tracking-wider font-mono ${
                        isHighlighted ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      / month
                    </span>
                  </div>

                  {billingCycle === 'annual' ? (
                    <p
                      className={`mt-1.5 font-mono text-[11px] tabular-nums ${
                        isHighlighted ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      ${tier.annualMonthlyPrice * 12} billed annually
                    </p>
                  ) : (
                    <p
                      className={`mt-1.5 font-mono text-[11px] ${
                        isHighlighted ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      Pre-Sale / Early Bird · Instant activation
                    </p>
                  )}

                  <p
                    className={`mt-5 text-sm leading-relaxed ${
                      isHighlighted ? 'text-neutral-300' : 'text-neutral-600'
                    }`}
                  >
                    {tier.description}
                  </p>

                  <ul className="mt-6 space-y-2.5 text-[13px] leading-snug">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            isHighlighted ? 'text-white' : 'text-black'
                          }`}
                          aria-hidden="true"
                        />
                        <span className={isHighlighted ? 'text-neutral-200' : 'text-neutral-700'}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-current/15">
                  <button
                    type="button"
                    disabled={loadingTierId !== null}
                    aria-busy={loadingTierId === tier.id}
                    onClick={() => onSelectStripePlan(tier, billingCycle, 'stripe')}
                    className={`w-full py-3.5 px-5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer ${
                      isHighlighted
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-black text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span>
                      {loadingTierId === tier.id ? 'Starting Checkout...' : tier.ctaLabel}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                  {checkoutError && errorTierId === tier.id && (
                    <p
                      className={`mt-3 text-xs font-medium ${
                        isHighlighted ? 'text-red-400' : 'text-red-600'
                      }`}
                      role="alert"
                    >
                      {checkoutError}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-black" aria-hidden="true" />
            <span>
              Encrypted membership checkout · Multiple payment options available at checkout
            </span>
          </div>
          <span>Model &amp; Talent · Studio Access · Clients &amp; Agencies</span>
        </div>
      </div>
    </section>
  );
};
