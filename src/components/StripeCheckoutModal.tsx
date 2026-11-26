import React, { useEffect, useState } from 'react';
import { X, Lock, CreditCard, CheckCircle2, ShieldCheck } from 'lucide-react';
import { MembershipTier, ROLE_OPTIONS, calculateExactAge } from '../data/clubData';
import type { PaymentProvider } from './MembershipSection';

interface StripeCheckoutModalProps {
  tier: MembershipTier | null;
  billingCycle: 'monthly' | 'annual';
  paymentProvider: PaymentProvider;
  onChangePaymentProvider: (provider: PaymentProvider) => void;
  sessionId: string | null;
  onClose: () => void;
  onSuccess: (result: {
    planName: string;
    memberCode: string;
    planId: MembershipTier['id'];
    billingCycle: 'monthly' | 'annual';
    sessionId: string;
    email: string;
    fullName: string;
  }) => void;
}

const CHECKOUT_ROLES = [
  'Brand / Client',
  ...ROLE_OPTIONS.map((r) => r.label),
];

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  tier,
  billingCycle,
  paymentProvider,
  onChangePaymentProvider,
  sessionId,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(tier?.defaultRole || 'Model');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentConsent, setParentConsent] = useState(false);
  const [submittedAsMinor, setSubmittedAsMinor] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);

  useEffect(() => {
    if (tier) {
      setRole(tier.defaultRole || 'Model');
      setConfirmedCode(null);
      setErrorMsg(null);
      setSubmittedAsMinor(false);
    }
  }, [tier, sessionId]);

  if (!tier) return null;

  const isTalentTier = tier.id !== 'clients';
  const calculatedAge = isTalentTier ? calculateExactAge(dateOfBirth) : null;
  const isMinor = isTalentTier && calculatedAge !== null && calculatedAge < 18;
  const todayIso = new Date().toISOString().slice(0, 10);

  const providerLabel = paymentProvider === 'square' ? 'Square' : 'Stripe';
  const monthlyEquivalent =
    billingCycle === 'annual' ? tier.annualMonthlyPrice : tier.monthlyPrice;
  const totalDue = billingCycle === 'annual' ? tier.annualMonthlyPrice * 12 : tier.monthlyPrice;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid applicant email address.');
      return;
    }
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (isTalentTier) {
      if (calculatedAge === null) {
        setErrorMsg('Please enter a valid Date of Birth.');
        return;
      }
      if (isMinor) {
        if (parentName.trim().length < 2) {
          setErrorMsg(
            'Applicants under 18 must be registered by a parent. Please enter the parent full name.'
          );
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
          setErrorMsg('Please enter a valid parent email address.');
          return;
        }
        if (parentPhone.replace(/\D/g, '').length < 7) {
          setErrorMsg('Please enter a valid parent phone number.');
          return;
        }
        if (!parentConsent) {
          setErrorMsg(
            'Please confirm parent consent and verified-client-only visibility.'
          );
          return;
        }
      }
    }
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 12) {
      setErrorMsg('Please enter a valid 16-digit card number.');
      return;
    }
    if (expiry.replace(/\D/g, '').length < 4 || cvc.length < 3) {
      setErrorMsg('Please complete the card expiration date and CVC.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/confirm-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          planId: tier.id,
          billingCycle,
          paymentProvider,
          cardLast4: cleanCard.slice(-4),
          sessionId,
          dateOfBirth: isTalentTier ? dateOfBirth : '',
          isMinor,
          visibilityScope: isMinor ? 'verified_clients_only' : 'public',
          parentName: isMinor ? parentName.trim() : '',
          parentEmail: isMinor ? parentEmail.trim().toLowerCase() : '',
          parentPhone: isMinor ? parentPhone.trim() : '',
          parentConsent: isMinor && parentConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Payment authorization failed.');
        setSubmitting(false);
        return;
      }

      setSubmittedAsMinor(Boolean(data.isMinor ?? isMinor));
      setConfirmedCode(data.memberCode);
      onSuccess({
        planName: tier.name,
        memberCode: data.memberCode,
        planId: tier.id,
        billingCycle,
        sessionId: data.sessionId || sessionId || '',
        email: email.trim(),
        fullName: fullName.trim(),
      });
    } catch {
      setErrorMsg(`Network error connecting to ${providerLabel} payment endpoint.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stripe-checkout-title"
    >
      <div className="bg-white text-black w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-black shadow-2xl">
        <div className="px-6 py-4 bg-black text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs font-mono tracking-wider uppercase">
              NYC Model Club · Open to All Models · {providerLabel} Checkout
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close membership checkout"
            className="p-1 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedCode ? (
          <div className="p-8 md:p-10 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-black mb-4" />
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Application Accepted &amp; Membership Active
            </p>
            <h3 className="font-display font-bold text-3xl mt-1">
              Welcome to NYC Model Club, {fullName}
            </h3>
            <p className="text-sm text-neutral-600 mt-3 max-w-md mx-auto">
              Your {tier.name} fee has been processed via {providerLabel} for{' '}
              <strong>{email}</strong> ({role}). Your verified Club Pass is{' '}
              <span className="font-mono font-semibold text-black">{confirmedCode}</span>.
              {submittedAsMinor &&
                ' This minor profile is marked private and visible exclusively to verified Clients & Agencies.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 px-8 py-3 bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
            >
              Enter NYC Model Club
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5">
            <div className="md:col-span-2 bg-neutral-100 p-6 border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col justify-between">
              <div>
                <p className="font-display font-extrabold text-sm tracking-tight text-black">
                  nyc model club.
                </p>
                <p className="text-xs text-neutral-500 mt-4 uppercase tracking-wider">
                  {billingCycle === 'annual' ? 'Annual Plan' : 'Monthly Fee'}
                </p>
                <h3 id="stripe-checkout-title" className="font-display font-bold text-xl mt-1">
                  {tier.name}
                </h3>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display font-bold text-3xl tabular-nums">
                    ${totalDue}
                  </span>
                  <span className="text-xs text-neutral-600">
                    /{billingCycle === 'annual' ? 'year' : 'month'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs font-mono text-neutral-500 mt-1 tabular-nums">
                    Equivalent to ${monthlyEquivalent}/mo
                  </p>
                )}

                <div className="mt-3 p-2.5 border border-black bg-white">
                  <p className="text-[11px] text-neutral-700 leading-snug">
                    Regular membership starts at $35/month starting February 2027.
                  </p>
                </div>

                <ul className="mt-6 space-y-2 text-xs text-neutral-700 border-t border-neutral-200 pt-4">
                  {tier.features.slice(0, 4).map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-200 text-[11px] text-neutral-500 font-mono">
                {sessionId ? `Session: ${sessionId}` : `TLS 1.3 · Powered by ${providerLabel}`}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="md:col-span-3 p-6 space-y-3.5">
              {/* Payment Provider Switcher */}
              <div>
                <span className="block text-xs font-medium text-neutral-700 mb-1">
                  Payment Method
                </span>
                <div
                  className="grid grid-cols-2 border border-neutral-300 bg-neutral-100 p-0.5"
                  role="group"
                  aria-label="Select payment provider"
                >
                  <button
                    type="button"
                    aria-pressed={paymentProvider === 'stripe'}
                    onClick={() => onChangePaymentProvider('stripe')}
                    className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      paymentProvider === 'stripe'
                        ? 'bg-black text-white'
                        : 'text-neutral-600 hover:text-black'
                    }`}
                  >
                    Pay with Stripe
                  </button>
                  <button
                    type="button"
                    aria-pressed={paymentProvider === 'square'}
                    onClick={() => onChangePaymentProvider('square')}
                    className={`py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      paymentProvider === 'square'
                        ? 'bg-black text-white'
                        : 'text-neutral-600 hover:text-black'
                    }`}
                  >
                    Pay with Square
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Sinclair"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Access Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:border-black focus:outline-none"
                  >
                    {CHECKOUT_ROLES.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={isTalentTier ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="applicant@nycmodelclub.com"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 focus:border-black focus:outline-none"
                  />
                </div>
                {isTalentTier && (
                  <div>
                    <label
                      htmlFor="checkout-dob"
                      className="block text-xs font-medium text-neutral-700 mb-1"
                    >
                      Date of Birth *
                    </label>
                    <input
                      id="checkout-dob"
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
                      className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:border-black focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {isTalentTier && calculatedAge !== null && (
                <p className="font-mono text-[11px] text-neutral-700">
                  {isMinor
                    ? `Calculated Age: ${calculatedAge} · Minor Detected · Visibility: Verified Clients Only`
                    : `Calculated Age: ${calculatedAge} · Standard Membership Eligibility`}
                </p>
              )}

              {isMinor && (
                <div className="border border-black bg-neutral-50 p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-black leading-snug">
                    Parent Registration Required (Under 18)
                  </p>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Under-18 profiles are hidden from public pages and visible exclusively to
                    verified Clients &amp; Agencies.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                      Parent Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Parent full name"
                      className="w-full px-3 py-1.5 bg-white text-xs border border-neutral-300 focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                        Parent Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        placeholder="parent@domain.com"
                        className="w-full px-3 py-1.5 bg-white text-xs border border-neutral-300 focus:border-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                        Parent Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="(212) 555-0194"
                        className="w-full px-3 py-1.5 bg-white text-xs border border-neutral-300 focus:border-black focus:outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      required
                      checked={parentConsent}
                      onChange={(e) => setParentConsent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-black shrink-0"
                    />
                    <span className="text-[11px] text-neutral-700 leading-snug">
                      I confirm I am the parent registering this minor and give consent for private
                      visibility restricted to verified Clients &amp; Agencies. *
                    </span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Card Details ({providerLabel})
                </label>
                <div className="border border-neutral-300 focus-within:border-black">
                  <div className="flex items-center px-3.5 py-2.5 border-b border-neutral-200">
                    <CreditCard className="w-4 h-4 text-neutral-400 mr-2.5 shrink-0" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      className="w-full text-sm font-mono tabular-nums focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-neutral-200">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      aria-label="Expiration date"
                      className="px-3.5 py-2.5 text-sm font-mono tabular-nums focus:outline-none"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="CVC"
                      aria-label="Security code"
                      className="px-3.5 py-2.5 text-sm font-mono tabular-nums focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 font-medium" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-black text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting
                  ? `Authorizing with ${providerLabel}...`
                  : `Apply & Pay $${totalDue} via ${providerLabel}`}
              </button>

              <p className="flex items-start justify-center gap-1.5 text-[11px] text-neutral-500 text-center leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" />
                <span>
                  Open to All Models · Minors under 18 must be registered by a parent and remain
                  hidden from public pages, visible only to verified clients
                </span>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
