import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import Stripe from 'stripe';
import type { ViteDevServer } from 'vite';
import { fileURLToPath } from 'url';
import {
  addNewsletterSubscriber,
  cancelMemberByStripeCustomer,
  createApplicationRecord,
  createBookingRecord,
  findBookingByStripeSession,
  findMemberByEmailAndPlan,
  findMemberByStripeSession,
  findOnboardingByStripeSession,
  findVerifiedClientMember,
  getAdminDashboardData,
  listApprovedDirectoryApplications,
  listApprovedOnboardingTalent,
  markBookingPaidByStripeSession,
  updateApplicationStatus,
  updateOnboardingNotification,
  updateOnboardingReviewStatus,
  upsertActiveMember,
  upsertMemberOnboarding,
} from './db.ts';
import type { MemberOnboardingRecord, OnboardingReviewStatus } from './db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

function resolveServerPort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (!isProd || (Number.isFinite(nginxPort) && nginxPort > 0 && envPort === nginxPort)) {
    return Number(process.env.DEFAULT_APP_PORT) || 3000;
  }

  return Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
}

const PORT = resolveServerPort();
const SUPPORT_CONTACT_EMAIL =
  process.env.CONTACT_EMAIL?.trim() ||
  process.env.VITE_CONTACT_EMAIL?.trim() ||
  'txmodelmanagement@gmail.com';

type PlanId = 'talent' | 'studio' | 'clients';
type BillingCycle = 'monthly' | 'annual';
type PaymentProvider = 'stripe' | 'square';

interface CheckoutBody {
  planId?: unknown;
  billingCycle?: unknown;
  paymentProvider?: unknown;
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
}

interface ConfirmMembershipBody {
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
  planId?: unknown;
  billingCycle?: unknown;
  paymentProvider?: unknown;
  cardLast4?: unknown;
  sessionId?: unknown;
  dateOfBirth?: unknown;
  isMinor?: unknown;
  parentName?: unknown;
  parentEmail?: unknown;
  parentPhone?: unknown;
  parentConsent?: unknown;
}

interface BookingCheckoutBody {
  bookingScope?: unknown;
  paymentProvider?: unknown;
  modelId?: unknown;
  modelName?: unknown;
  packageLabel?: unknown;
  productionPackage?: unknown;
  baseRateDollars?: unknown;
  productionRateDollars?: unknown;
  clientName?: unknown;
  clientEmail?: unknown;
  shootDate?: unknown;
  notes?: unknown;
  clientMember?: unknown;
}

interface ApplicationBody {
  fullName?: unknown;
  role?: unknown;
  borough?: unknown;
  email?: unknown;
  instagram?: unknown;
  dateOfBirth?: unknown;
  isMinor?: unknown;
  parentName?: unknown;
  parentEmail?: unknown;
  parentPhone?: unknown;
  parentConsent?: unknown;
}

interface NewsletterBody {
  email?: unknown;
}

interface OnboardingBody {
  sessionId?: unknown;
  planId?: unknown;
  billingCycle?: unknown;
  email?: unknown;
  fullName?: unknown;
  stageName?: unknown;
  measurements?: unknown;
  location?: unknown;
  portfolioUrl?: unknown;
  digitalsUrl?: unknown;
  studioShootSlot?: unknown;
  companyName?: unknown;
  companyRole?: unknown;
  projectType?: unknown;
  dateOfBirth?: unknown;
  isMinor?: unknown;
  parentName?: unknown;
  parentEmail?: unknown;
  parentPhone?: unknown;
  parentConsent?: unknown;
}

const PLAN_PRICING: Record<
  PlanId,
  { name: string; defaultRole: string; monthlyCents: number; annualCents: number }
> = {
  talent: {
    name: 'NYC Model Club: Model & Talent Membership',
    defaultRole: 'Model',
    monthlyCents: 2900,
    annualCents: 27600, // $23/mo billed annually
  },
  studio: {
    name: 'NYC Model Club: Studio Access',
    defaultRole: 'Model',
    monthlyCents: 5900,
    annualCents: 56400, // $47/mo billed annually
  },
  clients: {
    name: 'NYC Model Club: Clients & Agencies Access',
    defaultRole: 'Casting / Agency',
    monthlyCents: 9900,
    annualCents: 94800, // $79/mo billed annually
  },
};

type StripeKeyMode = 'stripe_live' | 'stripe_test' | 'test_fallback' | 'disabled';

function isPlaceholderStripeValue(val: string): boolean {
  if (!val) return true;
  const upper = val.toUpperCase();
  return (
    upper.includes('YOUR_') ||
    upper.includes('PLACEHOLDER') ||
    upper.includes('REPLACE_ME') ||
    upper.includes('CHANGEME') ||
    val.includes('<') ||
    val.includes('>')
  );
}

function getStripeConfig(): {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  testFallbackAllowed: boolean;
  mode: StripeKeyMode;
} {
  const rawSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
  const rawPublishable = (
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const rawWebhook = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  const isRealSecretFormat =
    rawSecret.startsWith('sk_test_') ||
    rawSecret.startsWith('sk_live_') ||
    rawSecret.startsWith('rk_test_') ||
    rawSecret.startsWith('rk_live_');
  const secretKey = !isPlaceholderStripeValue(rawSecret) && isRealSecretFormat ? rawSecret : '';

  const isRealPublishableFormat =
    rawPublishable.startsWith('pk_test_') || rawPublishable.startsWith('pk_live_');
  const publishableKey =
    !isPlaceholderStripeValue(rawPublishable) && isRealPublishableFormat ? rawPublishable : '';

  const webhookSecret = !isPlaceholderStripeValue(rawWebhook) ? rawWebhook : '';
  const testFallbackAllowed = process.env.STRIPE_TEST_MODE?.trim().toLowerCase() !== 'false';

  let mode: StripeKeyMode = 'disabled';
  if (secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_')) {
    mode = 'stripe_live';
  } else if (secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_')) {
    mode = 'stripe_test';
  } else if (testFallbackAllowed) {
    mode = 'test_fallback';
  }

  return {
    secretKey,
    publishableKey,
    webhookSecret,
    testFallbackAllowed,
    mode,
  };
}

function getStripeClient(): Stripe | null {
  const { secretKey } = getStripeConfig();
  if (!secretKey) {
    return null;
  }
  return new Stripe(secretKey);
}

function getWebhookSecret(): string {
  return getStripeConfig().webhookSecret;
}

function isStrictWebhookMode(): boolean {
  return Boolean(getStripeClient() && getWebhookSecret());
}

type SquareKeyMode = 'square_live' | 'square_sandbox' | 'test_fallback' | 'disabled';

function getSquareConfig(): {
  accessToken: string;
  locationId: string;
  env: 'production' | 'sandbox';
  apiBaseUrl: string;
  testFallbackAllowed: boolean;
  mode: SquareKeyMode;
} {
  const rawToken = (process.env.SQUARE_ACCESS_TOKEN || '').trim();
  const rawLocation = (process.env.SQUARE_LOCATION_ID || '').trim();
  const rawEnv = (process.env.SQUARE_ENV || 'sandbox').trim().toLowerCase();
  const env: 'production' | 'sandbox' = rawEnv === 'production' ? 'production' : 'sandbox';

  const accessToken =
    rawToken && !isPlaceholderStripeValue(rawToken) ? rawToken : '';
  const locationId =
    rawLocation && !isPlaceholderStripeValue(rawLocation) ? rawLocation : '';
  const testFallbackAllowed =
    process.env.SQUARE_TEST_MODE?.trim().toLowerCase() !== 'false';

  let mode: SquareKeyMode = 'disabled';
  if (accessToken && locationId) {
    mode = env === 'production' ? 'square_live' : 'square_sandbox';
  } else if (testFallbackAllowed) {
    mode = 'test_fallback';
  }

  return {
    accessToken,
    locationId,
    env,
    apiBaseUrl:
      env === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com',
    testFallbackAllowed,
    mode,
  };
}

function isSquareSessionId(sessionId: string): boolean {
  return sessionId.startsWith('sq_');
}

async function createSquarePaymentLink(params: {
  name: string;
  amountCents: number;
  redirectUrl: string;
  referenceId: string;
}): Promise<{ url: string; orderId: string; linkId: string }> {
  const cfg = getSquareConfig();
  if (!cfg.accessToken || !cfg.locationId) {
    throw new Error('Square credentials are not configured.');
  }

  const response = await fetch(`${cfg.apiBaseUrl}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Square-Version': '2024-11-20',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: params.name.slice(0, 250),
        price_money: {
          amount: Math.max(100, Math.round(params.amountCents)),
          currency: 'USD',
        },
        location_id: cfg.locationId,
      },
      checkout_options: {
        redirect_url: params.redirectUrl,
      },
      payment_note: params.referenceId.slice(0, 500),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    payment_link?: { id?: string; url?: string; order_id?: string };
    errors?: Array<{ detail?: string; code?: string }>;
  };

  if (!response.ok || !payload.payment_link?.url) {
    const errDetail =
      payload.errors?.[0]?.detail ||
      payload.errors?.[0]?.code ||
      `Square API returned status ${response.status}.`;
    throw new Error(errDetail);
  }

  return {
    url: payload.payment_link.url,
    orderId: payload.payment_link.order_id || '',
    linkId: payload.payment_link.id || '',
  };
}

async function retrieveSquareOrderState(orderId: string): Promise<{
  paid: boolean;
  state: string;
  totalCents: number;
}> {
  const cfg = getSquareConfig();
  if (!cfg.accessToken || !orderId) {
    return { paid: false, state: 'UNKNOWN', totalCents: 0 };
  }

  const response = await fetch(`${cfg.apiBaseUrl}/v2/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Square-Version': '2024-11-20',
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    order?: {
      state?: string;
      total_money?: { amount?: number };
      tenders?: Array<{ card_details?: { status?: string } }>;
    };
  };

  const state = payload.order?.state || 'UNKNOWN';
  const hasCapturedTender = Boolean(
    payload.order?.tenders?.some((t) => t.card_details?.status === 'CAPTURED')
  );
  const paid = state === 'COMPLETED' || hasCapturedTender;

  return {
    paid,
    state,
    totalCents: Number(payload.order?.total_money?.amount || 0),
  };
}

const pendingSquareCheckouts = new Map<
  string,
  {
    type: 'membership' | 'booking';
    orderId: string;
    planId?: PlanId;
    billingCycle?: BillingCycle;
    email?: string;
    fullName?: string;
    role?: string;
    amountCents: number;
    bookingRef?: string;
    bookingScope?: BookingScope;
    modelId?: string;
    modelName?: string;
    packageLabel?: string;
    productionPackage?: string;
    baseRateDollars?: number;
    productionRateDollars?: number;
    clientFeeDollars?: number;
    modelCommissionDollars?: number;
    memberDiscountDollars?: number;
    totalClientChargeDollars?: number;
    modelNetPayoutDollars?: number;
    clientName?: string;
    clientEmail?: string;
    shootDate?: string;
    notes?: string;
  }
>();

function isValidEmail(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 3 && trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function calculateExactAgeServer(dateOfBirth: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

function isValidPhone(val: string): boolean {
  const digits = val.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 20;
}

function parsePlanId(raw: unknown): PlanId | null {
  if (raw === 'talent' || raw === 'studio' || raw === 'clients') {
    return raw;
  }
  return null;
}

function parseBillingCycle(raw: unknown): BillingCycle | null {
  if (raw === 'monthly' || raw === 'annual') {
    return raw;
  }
  return null;
}

function parsePaymentProvider(raw: unknown): PaymentProvider {
  return raw === 'square' ? 'square' : 'stripe';
}

type BookingScope = 'model' | 'production' | 'bundle';

function parseBookingScope(raw: unknown): BookingScope {
  if (raw === 'production' || raw === 'bundle') {
    return raw;
  }
  return 'model';
}

function resolveAppUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
}

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const appUrlRaw = process.env.APP_URL?.trim();
  if (appUrlRaw && appUrlRaw !== 'MY_APP_URL') {
    for (const part of appUrlRaw.split(',')) {
      const cleaned = part.trim().replace(/\/+$/, '');
      if (cleaned) {
        origins.add(cleaned);
      }
    }
  }
  if (!isProd) {
    origins.add(`http://localhost:${PORT}`);
    origins.add(`http://127.0.0.1:${PORT}`);
  }
  return origins;
}

function safePasswordEqual(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const ADMIN_RATE_LIMIT_MAX_FAILED = 10;
const ADMIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface AdminRateLimitEntry {
  count: number;
  resetAt: number;
}

const adminFailedAttempts = new Map<string, AdminRateLimitEntry>();

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function pruneExpiredAdminAttempts(now: number): void {
  for (const [ip, entry] of adminFailedAttempts.entries()) {
    if (entry.resetAt <= now) {
      adminFailedAttempts.delete(ip);
    }
  }
}

function adminRateLimitGuard(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  pruneExpiredAdminAttempts(now);
  const clientIp = getClientIp(req);
  const entry = adminFailedAttempts.get(clientIp);

  if (entry && entry.resetAt > now && entry.count >= ADMIN_RATE_LIMIT_MAX_FAILED) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many failed admin login attempts. Please try again in 15 minutes.',
    });
    return;
  }

  next();
}

function recordFailedAdminAttempt(clientIp: string, now: number): void {
  const existing = adminFailedAttempts.get(clientIp);
  if (!existing || existing.resetAt <= now) {
    adminFailedAttempts.set(clientIp, {
      count: 1,
      resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  existing.count += 1;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const configuredEmail = (process.env.ADMIN_EMAIL || 'Victorqu@yahoo.com').trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD || '@@@Victorqu';

  res.setHeader('Cache-Control', 'no-store');

  if (!configuredEmail || !configuredPassword) {
    res.status(503).json({
      error: 'Admin access is disabled until ADMIN_EMAIL and ADMIN_PASSWORD are configured.',
    });
    return;
  }

  const headerEmail = (req.header('x-admin-email') || '').trim().toLowerCase();
  const headerPass = req.header('x-admin-password') || '';
  const authHeader = req.header('authorization') || '';
  const bearerPass = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const candidatePass = headerPass || bearerPass;

  if (
    !headerEmail ||
    !candidatePass ||
    !safePasswordEqual(headerEmail, configuredEmail) ||
    !safePasswordEqual(candidatePass, configuredPassword)
  ) {
    recordFailedAdminAttempt(clientIp, now);
    res.status(401).json({ error: 'Invalid admin email or password.' });
    return;
  }

  adminFailedAttempts.delete(clientIp);
  next();
}

function persistCompletedStripeSession(
  session: Stripe.Checkout.Session,
  webhookVerified = false
): {
  type: 'membership' | 'booking';
  id: string;
  planName?: string;
} {
  const metadata = session.metadata || {};
  if (metadata.checkoutType === 'booking') {
    const bookingScope = parseBookingScope(metadata.bookingScope);
    const baseRateDollars = Number(metadata.baseRateDollars || 0);
    const productionRateDollars = Number(metadata.productionRateDollars || 0);
    const memberDiscountDollars = Number(metadata.memberDiscountDollars || 0);
    const clientFeeDollars = Math.round(baseRateDollars * 0.2 * 100) / 100;
    const modelCommissionDollars = Math.round(baseRateDollars * 0.2 * 100) / 100;
    const totalClientChargeDollars = Math.max(
      0,
      Math.round(
        (baseRateDollars + clientFeeDollars + productionRateDollars - memberDiscountDollars) * 100
      ) / 100
    );
    const modelNetPayoutDollars =
      Math.round((baseRateDollars - modelCommissionDollars) * 100) / 100;

    const booking = markBookingPaidByStripeSession(session.id, {
      id: metadata.bookingRef || `NYCMM-${Date.now().toString().slice(-6)}`,
      bookingScope,
      modelId: metadata.modelId || 'media-only',
      modelName: metadata.modelName || 'Media & Visual Works Division',
      packageLabel: metadata.packageLabel || 'Booking Package',
      productionPackage: metadata.productionPackage || '',
      baseRateDollars,
      productionRateDollars,
      clientFeeDollars,
      modelCommissionDollars,
      totalClientChargeDollars,
      modelNetPayoutDollars,
      clientName:
        metadata.clientName || session.customer_details?.name || 'Booking Client',
      clientEmail:
        metadata.clientEmail ||
        session.customer_details?.email ||
        session.customer_email ||
        'unknown@client.com',
      shootDate: metadata.shootDate || 'To Be Confirmed',
      notes: metadata.notes || '',
    });

    return {
      type: 'booking',
      id: booking?.id || metadata.bookingRef || session.id,
    };
  }

  const planId = parsePlanId(metadata.planId) || 'talent';
  const billingCycle = parseBillingCycle(metadata.billingCycle) || 'monthly';
  const plan = PLAN_PRICING[planId];
  const expectedAmount = billingCycle === 'annual' ? plan.annualCents : plan.monthlyCents;
  const memberId = `NYCMC-${crypto.randomBytes(2).toString('hex').toUpperCase()}${Date.now()
    .toString()
    .slice(-2)}`;

  const existing = findMemberByStripeSession(session.id);
  const member = upsertActiveMember({
    id: existing?.id || memberId,
    email: (
      session.customer_details?.email ||
      session.customer_email ||
      metadata.email ||
      'member@nycmodelclub.com'
    )
      .trim()
      .toLowerCase(),
    fullName:
      cleanStr(session.customer_details?.name, 120) ||
      cleanStr(metadata.fullName, 120) ||
      'Club Member',
    role: cleanStr(metadata.role, 60) || plan.defaultRole,
    planId,
    billingCycle,
    amountCents:
      typeof session.amount_total === 'number' && session.amount_total > 0
        ? session.amount_total
        : expectedAmount,
    stripeSessionId: session.id,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
    webhookVerified,
  });

  return {
    type: 'membership',
    id: member.id,
    planName: plan.name,
  };
}

function cleanDigitalsAsset(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.slice(0, 2_500_000);
  }
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return trimmed.slice(0, 500);
  }
  return '';
}

async function sendOnboardingConfirmationNotification(
  record: MemberOnboardingRecord
): Promise<{ sent: boolean; channel: string; message: string }> {
  const planLabel = PLAN_PRICING[record.plan_id]?.name || record.plan_id;
  const displayName =
    record.plan_id === 'clients'
      ? record.company_name || record.full_name || record.email
      : record.stage_name || record.full_name || record.email;

  const subject = `NYC Model Club: ${planLabel} Onboarding Confirmed (${record.id})`;
  const studioLine =
    record.plan_id === 'studio' && record.studio_shoot_slot
      ? `Ripley Grier Studios (Manhattan) Shoot Request: ${record.studio_shoot_slot}\n`
      : '';
  const bodyText =
    `Welcome to NYC Model Club, ${displayName}.\n\n` +
    `Your ${planLabel} (${record.billing_cycle}) is active and your onboarding profile (${record.id}) has been received by New York City Model Management.\n` +
    studioLine +
    `\nDirect Inquiries: ${SUPPORT_CONTACT_EMAIL}\n` +
    `NYC Office: 99 Wall Street, Suite 1628, New York, NY 10005\n`;

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.EMAIL_FROM?.trim() || 'NYC Model Club <onboarding@nycmodelclub.com>';

  let channel = 'in_app_dispatch';
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [record.email],
          reply_to: SUPPORT_CONTACT_EMAIL,
          subject,
          text: bodyText,
        }),
      });
      if (response.ok) {
        channel = 'email_resend';
      } else {
        const errText = await response.text().catch(() => '');
        console.warn('Resend email dispatch returned non-OK:', response.status, errText);
      }
    } catch (err) {
      console.warn('Resend email dispatch error:', err);
    }
  }

  const notifiedAt = new Date().toISOString();
  updateOnboardingNotification(record.id, channel, notifiedAt);
  console.log(
    `[Onboarding Confirmation] ${record.id} -> ${record.email} (${planLabel}) via ${channel}`
  );

  return {
    sent: true,
    channel,
    message:
      channel === 'email_resend'
        ? `Confirmation email dispatched to ${record.email} and saved to the agency desk.`
        : `Confirmation notice triggered for ${record.email} and queued with the New York City Model Management desk.`,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = buildAllowedOrigins();
  app.use(
    '/api',
    cors((req, callback) => {
      const originHeader = req.headers.origin;
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (!origin) {
        callback(null, { origin: true });
        return;
      }

      const normalized = origin.replace(/\/+$/, '');
      const fwdHostHeader = req.headers['x-forwarded-host'];
      const hostHeader = req.headers.host;
      const rawHost =
        (Array.isArray(fwdHostHeader) ? fwdHostHeader[0] : fwdHostHeader) ||
        (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) ||
        '';
      const requestHost = rawHost.split(',')[0].trim().toLowerCase();

      let isSameHost = false;
      if (requestHost) {
        try {
          isSameHost = new URL(origin).host.toLowerCase() === requestHost;
        } catch {
          isSameHost = false;
        }
      }

      const allowed =
        isSameHost ||
        allowedOrigins.size === 0 ||
        allowedOrigins.has(normalized) ||
        (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized));

      callback(null, {
        origin: allowed,
        methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Admin-Email',
          'X-Admin-Password',
          'X-Client-Session-Id',
        ],
      });
    })
  );

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Stripe Webhook MUST be mounted before express.json() so signature verification receives the raw Buffer.
  app.post(
    '/api/webhook',
    express.raw({ type: 'application/json' }),
    (req: Request, res: Response) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!stripe || !webhookSecret) {
        res.status(503).json({ error: 'Stripe webhook endpoint is not configured.' });
        return;
      }

      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        res.status(400).json({ error: 'Missing Stripe-Signature header.' });
        return;
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid signature';
        console.error('Stripe webhook signature verification failed:', message);
        res.status(400).send(`Webhook Error: ${message}`);
        return;
      }

      try {
        if (
          event.type === 'checkout.session.completed' ||
          event.type === 'checkout.session.async_payment_succeeded'
        ) {
          const session = event.data.object as Stripe.Checkout.Session;
          const isPaid =
            session.payment_status === 'paid' ||
            session.payment_status === 'no_payment_required';
          if (isPaid) {
            persistCompletedStripeSession(session, true);
          }
        } else if (event.type === 'customer.subscription.deleted') {
          const subscription = event.data.object as Stripe.Subscription;
          if (typeof subscription.customer === 'string') {
            cancelMemberByStripeCustomer(subscription.customer);
          }
        }
      } catch (err) {
        console.error('Error processing Stripe webhook event:', err);
        res.status(500).json({ error: 'Failed to persist webhook event.' });
        return;
      }

      res.json({ received: true });
    }
  );

  // Route-specific 3mb JSON limit for onboarding digital headshot uploads before global 64kb JSON parser
  app.post('/api/onboarding', express.json({ limit: '3mb' }), async (req: Request, res: Response) => {
    const body = (req.body || {}) as OnboardingBody;
    const planId = parsePlanId(body.planId);
    const billingCycle = parseBillingCycle(body.billingCycle || 'monthly') || 'monthly';
    const sessionId = cleanStr(body.sessionId, 160);
    const emailRaw = cleanStr(body.email, 254);

    if (!planId) {
      res.status(400).json({ error: 'Valid membership planId (talent, studio, or clients) is required.' });
      return;
    }

    if (!sessionId) {
      res.status(403).json({
        error: 'A verified Stripe Checkout session is required before submitting onboarding.',
      });
      return;
    }

    const stripeConfig = getStripeConfig();
    const squareConfig = getSquareConfig();
    const stripe = getStripeClient();
    const webhookSecret = stripeConfig.webhookSecret;
    const isSquareSession = isSquareSessionId(sessionId);

    if (!isSquareSession) {
      if (
        (stripe || webhookSecret || !stripeConfig.testFallbackAllowed) &&
        sessionId.startsWith('cs_dev_')
      ) {
        res.status(403).json({
          error: 'Test-fallback checkout sessions are disabled when live/SDK Stripe Checkout is active.',
        });
        return;
      }
    } else if (
      (squareConfig.mode === 'square_live' ||
        squareConfig.mode === 'square_sandbox' ||
        !squareConfig.testFallbackAllowed) &&
      sessionId.startsWith('sq_dev_')
    ) {
      res.status(403).json({
        error: 'Test-fallback checkout sessions are disabled when Square Checkout is active.',
      });
      return;
    }

    const sessionMember = findMemberByStripeSession(sessionId);
    if (!sessionMember || sessionMember.status !== 'active') {
      res.status(403).json({
        error: 'Active paid membership verification not found for this checkout session.',
      });
      return;
    }

    if (!isSquareSession && isStrictWebhookMode() && sessionMember.webhook_verified !== 1) {
      res.status(403).json({
        error: 'Awaiting verified Stripe checkout.session.completed webhook confirmation.',
      });
      return;
    }

    const effectiveEmail = (isValidEmail(emailRaw) ? emailRaw : sessionMember.email || '')
      .trim()
      .toLowerCase();

    if (!isValidEmail(effectiveEmail)) {
      res.status(400).json({ error: 'A valid member email address is required.' });
      return;
    }

    const fullName = cleanStr(body.fullName, 120) || sessionMember?.full_name || '';
    const stageName = cleanStr(body.stageName, 100);
    const measurements = cleanStr(body.measurements, 120);
    const location = cleanStr(body.location, 120);
    const portfolioUrl = cleanStr(body.portfolioUrl, 300);
    const digitalsUrl = cleanDigitalsAsset(body.digitalsUrl);
    const studioShootSlot = cleanStr(body.studioShootSlot, 160);
    const companyName = cleanStr(body.companyName, 140);
    const companyRole = cleanStr(body.companyRole, 80);
    const projectType = cleanStr(body.projectType, 140);
    const dateOfBirth = cleanStr(body.dateOfBirth, 20);
    const calculatedAge = planId !== 'clients' ? calculateExactAgeServer(dateOfBirth) : null;
    const isMinor = planId !== 'clients' && calculatedAge !== null && calculatedAge < 18;
    const visibilityScope: 'public' | 'verified_clients_only' = isMinor
      ? 'verified_clients_only'
      : 'public';
    const parentName = cleanStr(body.parentName, 120);
    const parentEmail = cleanStr(body.parentEmail, 254).toLowerCase();
    const parentPhone = cleanStr(body.parentPhone, 40);
    const parentConsent =
      body.parentConsent === true ||
      body.parentConsent === 'true' ||
      body.parentConsent === 1;

    if (planId === 'clients') {
      if (companyName.length < 2) {
        res.status(400).json({ error: 'Company or brand name is required.' });
        return;
      }
      if (!companyRole) {
        res.status(400).json({ error: 'Please select your client/agency role.' });
        return;
      }
      if (projectType.length < 2) {
        res.status(400).json({ error: 'Please specify your upcoming project type.' });
        return;
      }
    } else {
      if (fullName.length < 2) {
        res.status(400).json({ error: 'Full name is required.' });
        return;
      }
      if (calculatedAge === null) {
        res.status(400).json({ error: 'A valid Date of Birth is required.' });
        return;
      }
      if (measurements.length < 2) {
        res.status(400).json({ error: 'Height and measurements are required.' });
        return;
      }
      if (location.length < 2) {
        res.status(400).json({ error: 'Current location / city is required.' });
        return;
      }
      if (isMinor) {
        if (parentName.length < 2) {
          res.status(400).json({
            error:
              'Applicants under 18 must be registered by a parent. Please provide the parent full name.',
          });
          return;
        }
        if (!isValidEmail(parentEmail)) {
          res.status(400).json({
            error: 'Please provide a valid parent email address for under-18 registration.',
          });
          return;
        }
        if (!isValidPhone(parentPhone)) {
          res.status(400).json({
            error: 'Please provide a valid parent phone number for under-18 registration.',
          });
          return;
        }
        if (!parentConsent) {
          res.status(400).json({
            error: 'Parent consent checkbox is required for applicants under 18.',
          });
          return;
        }
      }
      if (planId === 'studio' && studioShootSlot.length < 3) {
        res.status(400).json({
          error: 'Please enter a preferred date and time window for your Ripley Grier Studios (Manhattan) shoot.',
        });
        return;
      }
    }

    const linkedMember =
      sessionMember || findMemberByEmailAndPlan(effectiveEmail, planId) || null;
    const onboardingId = `OB-${Date.now().toString().slice(-6)}${crypto
      .randomBytes(1)
      .toString('hex')
      .toUpperCase()}`;

    const savedRecord = upsertMemberOnboarding({
      id: onboardingId,
      memberId: linkedMember?.id || null,
      stripeSessionId: sessionId || null,
      planId,
      billingCycle,
      email: effectiveEmail,
      fullName: fullName || companyName,
      stageName,
      measurements,
      location,
      portfolioUrl,
      digitalsUrl,
      studioShootSlot,
      companyName,
      companyRole,
      projectType,
      dateOfBirth: planId !== 'clients' ? dateOfBirth : '',
      isMinor,
      parentName: isMinor ? parentName : '',
      parentEmail: isMinor ? parentEmail : '',
      parentPhone: isMinor ? parentPhone : '',
      parentConsent: isMinor && parentConsent,
      visibilityScope,
    });

    const notification = await sendOnboardingConfirmationNotification(savedRecord);
    const refreshedRecord = findOnboardingByStripeSession(sessionId) || savedRecord;

    res.status(201).json({
      saved: true,
      onboarding: refreshedRecord,
      notification,
    });
  });

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    const config = getStripeConfig();
    const squareConfig = getSquareConfig();
    const stripeConfigured = Boolean(config.secretKey);
    const squareConfigured = Boolean(squareConfig.accessToken && squareConfig.locationId);
    const webhookConfigured = Boolean(config.webhookSecret);
    res.json({
      ok: true,
      environment: isProd ? 'production' : 'development',
      stripeConfigured,
      stripeMode: config.mode,
      stripeTestFallback: !stripeConfigured && config.testFallbackAllowed,
      squareConfigured,
      squareMode: squareConfig.mode,
      squareTestFallback: !squareConfigured && squareConfig.testFallbackAllowed,
      publishableKeyConfigured: Boolean(config.publishableKey),
      stripePublishableKey: config.publishableKey || null,
      webhookConfigured,
      strictWebhookVerification: Boolean(stripeConfigured && webhookConfigured),
      supportContactEmail: SUPPORT_CONTACT_EMAIL,
    });
  });

  const hasVerifiedClientSession = (req: Request): boolean => {
    const rawHeader = req.header('x-client-session-id');
    const clientSessionId = cleanStr(rawHeader, 160);
    if (!clientSessionId) return false;
    const member = findMemberByStripeSession(clientSessionId);
    if (!member || member.status !== 'active' || member.plan_id !== 'clients') {
      return false;
    }
    if (!isSquareSessionId(clientSessionId) && isStrictWebhookMode() && member.webhook_verified !== 1) {
      return false;
    }
    return true;
  };

  app.get('/api/roster/approved', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const includeClientsOnly = hasVerifiedClientSession(req);
    res.json({
      verifiedClient: includeClientsOnly,
      talent: listApprovedOnboardingTalent({ includeClientsOnly }),
    });
  });

  app.get('/api/directory/approved', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const includeClientsOnly = hasVerifiedClientSession(req);
    res.json({
      verifiedClient: includeClientsOnly,
      members: listApprovedDirectoryApplications({ includeClientsOnly }),
    });
  });

  app.post('/api/client-access/verify', (req, res) => {
    const body = (req.body || {}) as {
      email?: unknown;
      memberCode?: unknown;
      sessionId?: unknown;
    };
    const sessionId = cleanStr(body.sessionId, 160);
    if (sessionId) {
      const bySession = findMemberByStripeSession(sessionId);
      if (bySession && bySession.status === 'active' && bySession.plan_id === 'clients') {
        res.json({
          verified: true,
          sessionId: bySession.stripe_session_id || sessionId,
          memberCode: bySession.id,
          planName: PLAN_PRICING.clients.name,
          fullName: bySession.full_name,
        });
        return;
      }
      res.status(401).json({ error: 'Client & Agency session could not be verified.' });
      return;
    }

    const email = cleanStr(body.email, 254).toLowerCase();
    const memberCode = cleanStr(body.memberCode, 60).toUpperCase();
    if (!isValidEmail(email) || memberCode.length < 4) {
      res.status(400).json({
        error: 'Please enter your Clients & Agencies email and verified pass code (e.g. NYCMC-XXXX).',
      });
      return;
    }

    const member = findVerifiedClientMember(email, memberCode);
    if (!member) {
      res.status(401).json({
        error: 'No active Clients & Agencies pass found for that email and pass code.',
      });
      return;
    }

    res.json({
      verified: true,
      sessionId: member.stripe_session_id || '',
      memberCode: member.id,
      planName: PLAN_PRICING.clients.name,
      fullName: member.full_name,
    });
  });

  // 1. Club Membership & Access Checkout Session (Stripe or Square)
  app.post('/api/create-checkout-session', async (req, res) => {
    const body = (req.body || {}) as CheckoutBody;
    const planId = parsePlanId(body.planId);
    const billingCycle = parseBillingCycle(body.billingCycle || 'monthly');
    const paymentProvider = parsePaymentProvider(body.paymentProvider);

    if (!planId) {
      res.status(400).json({ error: 'Invalid planId. Expected talent, studio, or clients.' });
      return;
    }
    if (!billingCycle) {
      res.status(400).json({ error: 'Invalid billingCycle. Expected monthly or annual.' });
      return;
    }

    const email = body.email !== undefined ? cleanStr(body.email, 254) : '';
    if (email && !isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const fullName = cleanStr(body.fullName, 120);
    const role = cleanStr(body.role, 60);
    const plan = PLAN_PRICING[planId];
    const unitAmount = billingCycle === 'annual' ? plan.annualCents : plan.monthlyCents;
    const interval = billingCycle === 'annual' ? 'year' : 'month';
    const appUrl = resolveAppUrl(req);

    if (paymentProvider === 'square') {
      const squareConfig = getSquareConfig();
      if (!squareConfig.accessToken || !squareConfig.locationId) {
        if (!squareConfig.testFallbackAllowed) {
          res.status(503).json({
            error:
              'Square Checkout is disabled until SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are configured.',
          });
          return;
        }

        const devSquareSessionId = `sq_dev_${Date.now().toString(36)}`;
        res.json({
          mode: 'square_embedded',
          provider: 'square',
          testMode: true,
          sessionId: devSquareSessionId,
          planId,
          planName: plan.name,
          billingCycle,
          amountCents: unitAmount,
          currency: 'usd',
        });
        return;
      }

      try {
        const squareSessionId = `sq_${crypto.randomBytes(6).toString('hex')}`;
        const link = await createSquarePaymentLink({
          name: `${plan.name} (${billingCycle === 'annual' ? 'Annual' : 'Monthly'})`,
          amountCents: unitAmount,
          redirectUrl: `${appUrl}/onboarding?session_id=${encodeURIComponent(
            squareSessionId
          )}&plan=${planId}&cycle=${billingCycle}&provider=square`,
          referenceId: squareSessionId,
        });

        pendingSquareCheckouts.set(squareSessionId, {
          type: 'membership',
          orderId: link.orderId,
          planId,
          billingCycle,
          email,
          fullName,
          role: role || plan.defaultRole,
          amountCents: unitAmount,
        });

        res.json({
          mode: 'square_redirect',
          provider: 'square',
          sessionId: squareSessionId,
          url: link.url,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to initialize Square Checkout link.';
        console.error('Square membership link creation error:', message);
        res.status(400).json({ error: message });
      }
      return;
    }

    const stripeConfig = getStripeConfig();
    const stripe = getStripeClient();
    if (!stripe) {
      if (!stripeConfig.testFallbackAllowed) {
        res.status(503).json({
          error: 'Stripe Checkout is disabled until STRIPE_SECRET_KEY is configured.',
        });
        return;
      }

      const devSessionId = `cs_dev_${Date.now().toString(36)}`;
      res.json({
        mode: 'stripe_embedded',
        provider: 'stripe',
        testMode: true,
        sessionId: devSessionId,
        planId,
        planName: plan.name,
        billingCycle,
        amountCents: unitAmount,
        currency: 'usd',
      });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: `${appUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}&plan=${planId}&cycle=${billingCycle}&provider=stripe`,
        cancel_url: `${appUrl}/?checkout=cancelled#membership`,
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: unitAmount,
              recurring: { interval },
              product_data: {
                name: plan.name,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          checkoutType: 'membership',
          planId,
          billingCycle,
          fullName,
          role: role || plan.defaultRole,
          email,
        },
      });

      if (!session.url) {
        res.status(502).json({ error: 'Stripe Checkout did not return a session URL.' });
        return;
      }

      res.json({
        mode: 'stripe_redirect',
        provider: 'stripe',
        sessionId: session.id,
        url: session.url,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to initialize Stripe Checkout session.';
      console.error('Stripe membership session creation error:', message);
      res.status(400).json({ error: message });
    }
  });

  // Test-mode fallback confirmation route when provider keys are not set yet;
  // automatically disabled once real provider keys or *_TEST_MODE=false are configured.
  app.post('/api/confirm-membership', (req, res) => {
    const body = (req.body || {}) as ConfirmMembershipBody;
    const paymentProvider = parsePaymentProvider(body.paymentProvider);

    if (paymentProvider === 'square') {
      const squareConfig = getSquareConfig();
      if (
        (squareConfig.accessToken && squareConfig.locationId) ||
        !squareConfig.testFallbackAllowed
      ) {
        res.status(403).json({
          error: 'Direct test-mode confirmation is disabled when live/sandbox Square Checkout is active.',
        });
        return;
      }
    } else {
      const stripeConfig = getStripeConfig();
      if (getStripeClient() || stripeConfig.webhookSecret || !stripeConfig.testFallbackAllowed) {
        res.status(403).json({
          error: 'Direct test-mode confirmation is disabled when live/SDK Stripe Checkout is active.',
        });
        return;
      }
    }

    if (!isValidEmail(body.email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const fullName = cleanStr(body.fullName, 120);
    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }

    const planId = parsePlanId(body.planId);
    const billingCycle = parseBillingCycle(body.billingCycle || 'monthly');
    if (!planId || !billingCycle) {
      res.status(400).json({ error: 'Valid membership plan and billing cycle are required.' });
      return;
    }

    const plan = PLAN_PRICING[planId];
    const role = cleanStr(body.role, 60) || plan.defaultRole;
    const dateOfBirth = cleanStr(body.dateOfBirth, 20);
    const calculatedAge = planId !== 'clients' ? calculateExactAgeServer(dateOfBirth) : null;
    const isMinor = planId !== 'clients' && calculatedAge !== null && calculatedAge < 18;
    const visibilityScope: 'public' | 'verified_clients_only' = isMinor
      ? 'verified_clients_only'
      : 'public';
    const parentName = cleanStr(body.parentName, 120);
    const parentEmail = cleanStr(body.parentEmail, 254).toLowerCase();
    const parentPhone = cleanStr(body.parentPhone, 40);
    const parentConsent =
      body.parentConsent === true ||
      body.parentConsent === 'true' ||
      body.parentConsent === 1;

    if (planId !== 'clients') {
      if (calculatedAge === null) {
        res.status(400).json({ error: 'A valid Date of Birth is required.' });
        return;
      }
      if (isMinor) {
        if (parentName.length < 2) {
          res.status(400).json({
            error:
              'Applicants under 18 must be registered by a parent. Please enter the parent full name.',
          });
          return;
        }
        if (!isValidEmail(parentEmail)) {
          res.status(400).json({
            error: 'Please provide a valid parent email address for under-18 registration.',
          });
          return;
        }
        if (!isValidPhone(parentPhone)) {
          res.status(400).json({
            error: 'Please provide a valid parent phone number for under-18 registration.',
          });
          return;
        }
        if (!parentConsent) {
          res.status(400).json({
            error: 'Parent consent is required to register an applicant under 18.',
          });
          return;
        }
      }
    }

    const cardLast4Raw = cleanStr(body.cardLast4, 4);
    const cardLast4 = /^\d{4}$/.test(cardLast4Raw) ? cardLast4Raw : '4242';
    const amountCents = billingCycle === 'annual' ? plan.annualCents : plan.monthlyCents;
    const memberCode = `NYCMC-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const defaultPrefix = paymentProvider === 'square' ? 'sq_dev_' : 'cs_dev_';
    const rawSessionId = cleanStr(body.sessionId, 120);
    const effectiveSessionId =
      rawSessionId &&
      ((paymentProvider === 'square' && rawSessionId.startsWith('sq_')) ||
        (paymentProvider === 'stripe' && rawSessionId.startsWith('cs_')))
        ? rawSessionId
        : `${defaultPrefix}${Date.now().toString(36)}`;

    const record = upsertActiveMember({
      id: memberCode,
      email: body.email.trim().toLowerCase(),
      fullName,
      role,
      planId,
      billingCycle,
      amountCents,
      stripeSessionId: effectiveSessionId,
      cardLast4,
      dateOfBirth: planId !== 'clients' ? dateOfBirth : '',
      isMinor,
      parentName: isMinor ? parentName : '',
      parentEmail: isMinor ? parentEmail : '',
      parentPhone: isMinor ? parentPhone : '',
      parentConsent: isMinor && parentConsent,
      visibilityScope,
    });

    res.json({
      confirmed: true,
      provider: paymentProvider,
      memberCode: record.id,
      sessionId: effectiveSessionId,
      planId,
      billingCycle,
      cardLast4,
      isMinor,
      visibilityScope,
      dateOfBirth: planId !== 'clients' ? dateOfBirth : '',
      record,
    });
  });

  // Verify completed Checkout Session (Stripe or Square) when returning to /onboarding or success_url
  app.get('/api/checkout-session/:sessionId', async (req, res) => {
    const sessionId = cleanStr(req.params.sessionId, 160);
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId.' });
      return;
    }

    const isSquare = isSquareSessionId(sessionId);
    const stripeConfig = getStripeConfig();
    const squareConfig = getSquareConfig();
    const stripe = getStripeClient();
    const webhookSecret = stripeConfig.webhookSecret;
    const strictWebhook = !isSquare && Boolean(stripe && webhookSecret);

    // Block test-fallback session IDs whenever real provider keys are configured or TEST_MODE=false
    if (!isSquare && (stripe || webhookSecret || !stripeConfig.testFallbackAllowed) && sessionId.startsWith('cs_dev_')) {
      res.status(403).json({
        confirmed: false,
        error: 'Test-fallback checkout sessions are disabled when live/SDK Stripe Checkout is active.',
      });
      return;
    }
    if (
      isSquare &&
      ((squareConfig.accessToken && squareConfig.locationId) || !squareConfig.testFallbackAllowed) &&
      sessionId.startsWith('sq_dev_')
    ) {
      res.status(403).json({
        confirmed: false,
        error: 'Test-fallback checkout sessions are disabled when Square Checkout is active.',
      });
      return;
    }

    const existingMember = findMemberByStripeSession(sessionId);
    if (existingMember) {
      if (strictWebhook && existingMember.webhook_verified !== 1) {
        res.status(202).json({
          confirmed: false,
          pendingWebhook: true,
          status: 'awaiting_webhook_verification',
          message:
            'Awaiting verified Stripe checkout.session.completed webhook confirmation.',
        });
        return;
      }

      const planId = parsePlanId(existingMember.plan_id) || 'talent';
      const plan = PLAN_PRICING[planId];
      const existingOnboarding = findOnboardingByStripeSession(sessionId) || null;
      res.json({
        confirmed: existingMember.status === 'active',
        webhookVerified: existingMember.webhook_verified === 1,
        provider: isSquare ? 'square' : 'stripe',
        type: 'membership',
        planId,
        planName: plan.name,
        billingCycle: existingMember.billing_cycle,
        amountCents: existingMember.amount_cents,
        paymentStatus: existingMember.status === 'active' ? 'Paid · Active' : existingMember.status,
        memberCode: existingMember.id,
        email: existingMember.email,
        fullName: existingMember.full_name,
        role: existingMember.role,
        dateOfBirth: existingMember.date_of_birth || '',
        isMinor: existingMember.is_minor === 1,
        parentName: existingMember.parent_name || '',
        parentEmail: existingMember.parent_email || '',
        parentPhone: existingMember.parent_phone || '',
        parentConsent: existingMember.parent_consent === 1,
        visibilityScope:
          existingMember.is_minor === 1 || existingMember.visibility_scope === 'verified_clients_only'
            ? 'verified_clients_only'
            : 'public',
        onboarding: existingOnboarding,
      });
      return;
    }

    const existingBooking = findBookingByStripeSession(sessionId);
    if (existingBooking && existingBooking.status === 'paid') {
      res.json({
        confirmed: true,
        provider: isSquare ? 'square' : 'stripe',
        type: 'booking',
        reference: existingBooking.id,
        modelName: existingBooking.model_name,
      });
      return;
    }

    if (isSquare) {
      const pending = pendingSquareCheckouts.get(sessionId);
      if (!pending || !squareConfig.accessToken) {
        res.status(404).json({ confirmed: false, error: 'Square checkout session not found.' });
        return;
      }

      try {
        const orderState = await retrieveSquareOrderState(pending.orderId);
        if (!orderState.paid) {
          res.status(403).json({
            confirmed: false,
            status: orderState.state,
            error: 'Square checkout payment has not been completed.',
          });
          return;
        }

        if (pending.type === 'booking') {
          const booking = markBookingPaidByStripeSession(sessionId, {
            id: pending.bookingRef || `NYCMM-${Date.now().toString().slice(-6)}`,
            bookingScope: pending.bookingScope || 'model',
            modelId: pending.modelId || 'media-only',
            modelName: pending.modelName || 'Media & Visual Works Only',
            packageLabel: pending.packageLabel || 'Booking Package',
            productionPackage: pending.productionPackage || '',
            baseRateDollars: pending.baseRateDollars || 0,
            productionRateDollars: pending.productionRateDollars || 0,
            clientFeeDollars: pending.clientFeeDollars || 0,
            modelCommissionDollars: pending.modelCommissionDollars || 0,
            totalClientChargeDollars: pending.totalClientChargeDollars || 0,
            modelNetPayoutDollars: pending.modelNetPayoutDollars || 0,
            clientName: pending.clientName || 'Booking Client',
            clientEmail: pending.clientEmail || 'unknown@client.com',
            shootDate: pending.shootDate || 'To Be Confirmed',
            notes: pending.notes || '',
          });
          pendingSquareCheckouts.delete(sessionId);
          res.json({
            confirmed: true,
            provider: 'square',
            type: 'booking',
            reference: booking?.id || pending.bookingRef,
            modelName: booking?.model_name || pending.modelName,
          });
          return;
        }

        const planId = pending.planId || 'talent';
        const billingCycle = pending.billingCycle || 'monthly';
        const plan = PLAN_PRICING[planId];
        const memberId = `NYCMC-${crypto.randomBytes(2).toString('hex').toUpperCase()}${Date.now()
          .toString()
          .slice(-2)}`;
        const memberRecord = upsertActiveMember({
          id: memberId,
          email: (pending.email || 'member@nycmodelclub.com').trim().toLowerCase(),
          fullName: pending.fullName || 'Club Member',
          role: pending.role || plan.defaultRole,
          planId,
          billingCycle,
          amountCents: orderState.totalCents || pending.amountCents,
          stripeSessionId: sessionId,
          webhookVerified: false,
        });
        pendingSquareCheckouts.delete(sessionId);
        const existingOnboarding = findOnboardingByStripeSession(sessionId) || null;
        res.json({
          confirmed: true,
          webhookVerified: false,
          provider: 'square',
          type: 'membership',
          planId,
          planName: plan.name,
          billingCycle,
          amountCents: memberRecord.amount_cents,
          paymentStatus: 'Paid · Active',
          memberCode: memberRecord.id,
          email: memberRecord.email,
          fullName: memberRecord.full_name,
          role: memberRecord.role,
          onboarding: existingOnboarding,
        });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to verify Square checkout session.';
        res.status(400).json({ confirmed: false, error: message });
        return;
      }
    }

    if (!stripe) {
      res.status(404).json({ confirmed: false, error: 'Checkout session not found.' });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const isPaid =
        session.status === 'complete' &&
        (session.payment_status === 'paid' || session.payment_status === 'no_payment_required');

      if (!isPaid) {
        res.status(403).json({
          confirmed: false,
          status: session.status,
          paymentStatus: session.payment_status,
          error: 'Stripe checkout payment has not been completed.',
        });
        return;
      }

      // When STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both active, ONLY checkout.session.completed
      // webhook persistence unlocks /onboarding & /welcome—never bypass via client retrieve!
      if (strictWebhook) {
        res.status(202).json({
          confirmed: false,
          pendingWebhook: true,
          status: 'awaiting_webhook_verification',
          message:
            'Payment received by Stripe; awaiting verified checkout.session.completed webhook confirmation.',
        });
        return;
      }

      const persisted = persistCompletedStripeSession(session, false);
      if (persisted.type === 'membership') {
        const memberRecord = findMemberByStripeSession(session.id);
        const planId = parsePlanId(memberRecord?.plan_id) || 'talent';
        const existingOnboarding = findOnboardingByStripeSession(session.id) || null;
        res.json({
          confirmed: true,
          webhookVerified: false,
          type: 'membership',
          planId,
          planName: persisted.planName || PLAN_PRICING[planId].name,
          billingCycle: memberRecord?.billing_cycle || 'monthly',
          amountCents: memberRecord?.amount_cents || PLAN_PRICING[planId].monthlyCents,
          paymentStatus: 'Paid · Active',
          memberCode: persisted.id,
          email: memberRecord?.email || session.customer_details?.email || '',
          fullName: memberRecord?.full_name || session.customer_details?.name || '',
          role: memberRecord?.role || PLAN_PRICING[planId].defaultRole,
          onboarding: existingOnboarding,
        });
        return;
      }

      res.json({
        confirmed: true,
        type: persisted.type,
        planName: persisted.planName,
        memberCode: persisted.id,
        reference: persisted.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify Stripe session.';
      res.status(400).json({ confirmed: false, error: message });
    }
  });

  // 2. New York City Model Management + Media & Visual Works — Online Booking & Payment (Stripe or Square)
  app.post('/api/bookings/checkout', async (req, res) => {
    const body = (req.body || {}) as BookingCheckoutBody;
    const bookingScope = parseBookingScope(body.bookingScope);
    const paymentProvider = parsePaymentProvider(body.paymentProvider);
    const modelId = cleanStr(body.modelId, 80);
    const modelName = cleanStr(body.modelName, 120);
    const packageLabel = cleanStr(body.packageLabel, 120) || 'Booking Package';
    const productionPackage = cleanStr(body.productionPackage, 140);
    const clientName = cleanStr(body.clientName, 120);
    const shootDate = cleanStr(body.shootDate, 80) || 'To Be Confirmed';
    const notes = cleanStr(body.notes, 600);
    const baseRateDollars =
      bookingScope === 'production' ? 0 : Number(body.baseRateDollars || 0);
    const productionRateDollars =
      bookingScope === 'model' ? 0 : Number(body.productionRateDollars || 0);

    if (!clientName || !isValidEmail(body.clientEmail)) {
      res.status(400).json({
        error: 'Brand/agency name and a valid business email are required.',
      });
      return;
    }

    if (bookingScope !== 'production') {
      if (!modelId || !modelName) {
        res.status(400).json({ error: 'Please select a represented model.' });
        return;
      }
      if (!Number.isFinite(baseRateDollars) || baseRateDollars < 100 || baseRateDollars > 250000) {
        res.status(400).json({ error: 'Valid model booking package rate is required.' });
        return;
      }
    }

    if (bookingScope !== 'model') {
      if (!productionPackage) {
        res.status(400).json({ error: 'Please select a Media & Visual Works service.' });
        return;
      }
      if (
        !Number.isFinite(productionRateDollars) ||
        productionRateDollars < 100 ||
        productionRateDollars > 250000
      ) {
        res.status(400).json({ error: 'Valid Media Production package rate is required.' });
        return;
      }
    }

    const effectiveModelId = bookingScope === 'production' ? 'media-only' : modelId;
    const effectiveModelName =
      bookingScope === 'production' ? 'Media & Visual Works Only' : modelName;
    const effectivePackageLabel =
      bookingScope === 'production'
        ? productionPackage
        : bookingScope === 'bundle'
          ? `${packageLabel} + ${productionPackage}`
          : packageLabel;

    const clientEmail = body.clientEmail.trim().toLowerCase();
    const isClientMember = body.clientMember === true;
    const clientFeeDollars = Math.round(baseRateDollars * 0.2 * 100) / 100;
    const modelCommissionDollars = Math.round(baseRateDollars * 0.2 * 100) / 100;
    const grossClientSubtotal = baseRateDollars + clientFeeDollars + productionRateDollars;
    const memberDiscountDollars = isClientMember
      ? Math.round(grossClientSubtotal * 0.15 * 100) / 100
      : 0;
    const totalClientChargeDollars = Math.max(
      0,
      Math.round((grossClientSubtotal - memberDiscountDollars) * 100) / 100
    );
    const modelNetPayoutDollars =
      Math.round((baseRateDollars - modelCommissionDollars) * 100) / 100;
    const reference = `NYCMM-${Date.now().toString().slice(-6)}`;
    const appUrl = resolveAppUrl(req);
    const productLabel =
      bookingScope === 'production'
        ? `NYC Model Club Media & Visual Works: ${productionPackage}`
        : bookingScope === 'bundle'
          ? `NYC Model Club Bundle: ${effectiveModelName} (${packageLabel}) + ${productionPackage}`
          : `NYC Model Management: ${effectiveModelName} (${packageLabel})`;

    if (paymentProvider === 'square') {
      const squareConfig = getSquareConfig();
      if (!squareConfig.accessToken || !squareConfig.locationId) {
        if (!squareConfig.testFallbackAllowed) {
          res.status(503).json({
            error:
              'Square Checkout is disabled for online bookings until SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are configured.',
          });
          return;
        }

        createBookingRecord({
          id: reference,
          bookingScope,
          modelId: effectiveModelId,
          modelName: effectiveModelName,
          packageLabel: effectivePackageLabel,
          productionPackage,
          baseRateDollars,
          productionRateDollars,
          clientFeeDollars,
          modelCommissionDollars,
          totalClientChargeDollars,
          modelNetPayoutDollars,
          clientName,
          clientEmail,
          shootDate,
          notes,
          status: 'paid',
        });

        res.json({
          mode: 'square_embedded_paid',
          provider: 'square',
          testMode: true,
          reference,
          breakdown: {
            bookingScope,
            baseRateDollars,
            productionRateDollars,
            clientFeeDollars,
            memberDiscountDollars,
            totalClientChargeDollars,
          },
          message: 'Online booking payment authorized via NYC Model Club (Square Test Mode).',
        });
        return;
      }

      try {
        const squareSessionId = `sq_${crypto.randomBytes(6).toString('hex')}`;
        const link = await createSquarePaymentLink({
          name: productLabel,
          amountCents: Math.round(totalClientChargeDollars * 100),
          redirectUrl: `${appUrl}/model-management?booking=paid&provider=square&model=${encodeURIComponent(
            effectiveModelName
          )}&session_id=${encodeURIComponent(squareSessionId)}`,
          referenceId: reference,
        });

        pendingSquareCheckouts.set(squareSessionId, {
          type: 'booking',
          orderId: link.orderId,
          amountCents: Math.round(totalClientChargeDollars * 100),
          bookingRef: reference,
          bookingScope,
          modelId: effectiveModelId,
          modelName: effectiveModelName,
          packageLabel: effectivePackageLabel,
          productionPackage,
          baseRateDollars,
          productionRateDollars,
          clientFeeDollars,
          modelCommissionDollars,
          memberDiscountDollars,
          totalClientChargeDollars,
          modelNetPayoutDollars,
          clientName,
          clientEmail,
          shootDate,
          notes,
        });

        createBookingRecord({
          id: reference,
          bookingScope,
          modelId: effectiveModelId,
          modelName: effectiveModelName,
          packageLabel: effectivePackageLabel,
          productionPackage,
          baseRateDollars,
          productionRateDollars,
          clientFeeDollars,
          modelCommissionDollars,
          totalClientChargeDollars,
          modelNetPayoutDollars,
          clientName,
          clientEmail,
          shootDate,
          notes,
          status: 'pending_payment',
          stripeSessionId: squareSessionId,
        });

        res.json({
          mode: 'square_redirect',
          provider: 'square',
          sessionId: squareSessionId,
          url: link.url,
          reference,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to initialize Square booking checkout.';
        console.error('Booking Square checkout error:', message);
        res.status(400).json({ error: message });
      }
      return;
    }

    const stripeConfig = getStripeConfig();
    const stripe = getStripeClient();
    if (!stripe) {
      if (!stripeConfig.testFallbackAllowed) {
        res.status(503).json({
          error: 'Stripe Checkout is disabled for online bookings until STRIPE_SECRET_KEY is configured.',
        });
        return;
      }

      createBookingRecord({
        id: reference,
        bookingScope,
        modelId: effectiveModelId,
        modelName: effectiveModelName,
        packageLabel: effectivePackageLabel,
        productionPackage,
        baseRateDollars,
        productionRateDollars,
        clientFeeDollars,
        modelCommissionDollars,
        totalClientChargeDollars,
        modelNetPayoutDollars,
        clientName,
        clientEmail,
        shootDate,
        notes,
        status: 'paid',
      });

      res.json({
        mode: 'stripe_embedded_paid',
        provider: 'stripe',
        testMode: true,
        reference,
        breakdown: {
          bookingScope,
          baseRateDollars,
          productionRateDollars,
          clientFeeDollars,
          memberDiscountDollars,
          totalClientChargeDollars,
        },
        message: 'Online booking payment authorized via NYC Model Club (Stripe Test Mode).',
      });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: `${appUrl}/model-management?booking=paid&model=${encodeURIComponent(
          effectiveModelName
        )}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/model-management?booking=cancelled`,
        customer_email: clientEmail,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(totalClientChargeDollars * 100),
              product_data: {
                name: productLabel,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          checkoutType: 'booking',
          bookingScope,
          bookingRef: reference,
          modelId: effectiveModelId,
          modelName: effectiveModelName,
          packageLabel: effectivePackageLabel,
          productionPackage,
          baseRateDollars: String(baseRateDollars),
          productionRateDollars: String(productionRateDollars),
          memberDiscountDollars: String(memberDiscountDollars),
          clientName,
          clientEmail,
          shootDate,
          notes: notes.slice(0, 450),
        },
      });

      createBookingRecord({
        id: reference,
        bookingScope,
        modelId: effectiveModelId,
        modelName: effectiveModelName,
        packageLabel: effectivePackageLabel,
        productionPackage,
        baseRateDollars,
        productionRateDollars,
        clientFeeDollars,
        modelCommissionDollars,
        totalClientChargeDollars,
        modelNetPayoutDollars,
        clientName,
        clientEmail,
        shootDate,
        notes,
        status: 'pending_payment',
        stripeSessionId: session.id,
      });

      if (!session.url) {
        res.status(502).json({ error: 'Stripe Checkout did not return a session URL.' });
        return;
      }

      res.json({
        mode: 'stripe_redirect',
        sessionId: session.id,
        url: session.url,
        reference,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to initialize Stripe booking checkout.';
      console.error('Booking Stripe checkout error:', message);
      res.status(400).json({ error: message });
    }
  });

  // 3. Open directory talent applications
  app.post('/api/applications', (req, res) => {
    const body = (req.body || {}) as ApplicationBody;
    const fullName = cleanStr(body.fullName, 120);
    const role = cleanStr(body.role, 60) || 'Model';
    const borough = cleanStr(body.borough, 80) || 'Manhattan, NY';
    const instagram = cleanStr(body.instagram, 100);
    const dateOfBirth = cleanStr(body.dateOfBirth, 20);
    const calculatedAge = calculateExactAgeServer(dateOfBirth);
    const isMinor = calculatedAge !== null && calculatedAge < 18;
    const visibilityScope: 'public' | 'verified_clients_only' = isMinor
      ? 'verified_clients_only'
      : 'public';
    const parentName = cleanStr(body.parentName, 120);
    const parentEmail = cleanStr(body.parentEmail, 254).toLowerCase();
    const parentPhone = cleanStr(body.parentPhone, 40);
    const parentConsent =
      body.parentConsent === true ||
      body.parentConsent === 'true' ||
      body.parentConsent === 1;

    if (fullName.length < 2 || !isValidEmail(body.email)) {
      res.status(400).json({ error: 'Full name and valid email address are required.' });
      return;
    }

    if (calculatedAge === null) {
      res.status(400).json({ error: 'A valid Date of Birth is required.' });
      return;
    }

    if (isMinor) {
      if (parentName.length < 2) {
        res.status(400).json({
          error:
            'Applicants under 18 must be registered by a parent. Please enter the parent full name.',
        });
        return;
      }
      if (!isValidEmail(parentEmail)) {
        res.status(400).json({
          error: 'Please provide a valid parent email address for under-18 registration.',
        });
        return;
      }
      if (!isValidPhone(parentPhone)) {
        res.status(400).json({
          error: 'Please provide a valid parent phone number for under-18 registration.',
        });
        return;
      }
      if (!parentConsent) {
        res.status(400).json({
          error: 'Parent consent is required to register an applicant under 18.',
        });
        return;
      }
    }

    const profileId = `CR-${Date.now().toString().slice(-5)}${crypto
      .randomBytes(1)
      .toString('hex')
      .toUpperCase()}`;

    const record = createApplicationRecord({
      id: profileId,
      fullName,
      role,
      borough,
      email: body.email.trim().toLowerCase(),
      instagram,
      dateOfBirth,
      isMinor,
      parentName: isMinor ? parentName : '',
      parentEmail: isMinor ? parentEmail : '',
      parentPhone: isMinor ? parentPhone : '',
      parentConsent: isMinor && parentConsent,
      visibilityScope,
    });

    res.status(201).json({
      created: true,
      profileId: record.id,
      isMinor,
      visibilityScope,
      application: record,
      message: isMinor
        ? 'Minor application registered as private/restricted for verified Clients & Agencies only.'
        : 'Your application has been registered on NYC Model Club.',
    });
  });

  // 4. Newsletter signup
  app.post('/api/newsletter', (req, res) => {
    const body = (req.body || {}) as NewsletterBody;
    if (!isValidEmail(body.email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const normalizedEmail = body.email.trim().toLowerCase();
    addNewsletterSubscriber(normalizedEmail);
    res.json({
      subscribed: true,
      email: normalizedEmail,
    });
  });

  // 5. Protected Admin API (/api/admin/data & /api/admin/applications/:id)
  app.use('/api/admin', adminRateLimitGuard, requireAdmin);

  app.get('/api/admin/data', (_req, res) => {
    try {
      const raw = getAdminDashboardData();
      const members = Array.isArray(raw?.members) ? raw.members : [];
      const bookings = Array.isArray(raw?.bookings) ? raw.bookings : [];
      const applications = Array.isArray(raw?.applications) ? raw.applications : [];
      const newsletterSubscribers = Array.isArray(raw?.newsletterSubscribers)
        ? raw.newsletterSubscribers
        : [];
      const onboarding = Array.isArray(raw?.onboarding) ? raw.onboarding : [];

      res.json({
        members,
        bookings,
        applications,
        newsletterSubscribers,
        onboarding,
        stats: {
          activeMembersCount:
            raw?.stats?.activeMembersCount ??
            members.filter((m) => m.status === 'active').length,
          totalBookingsCount: raw?.stats?.totalBookingsCount ?? bookings.length,
          paidBookingsCount:
            raw?.stats?.paidBookingsCount ??
            bookings.filter((b) => b.status === 'paid').length,
          pendingApplicationsCount:
            raw?.stats?.pendingApplicationsCount ??
            applications.filter((a) => a.status === 'pending').length,
          newsletterCount: raw?.stats?.newsletterCount ?? newsletterSubscribers.length,
          newOnboardingCount:
            raw?.stats?.newOnboardingCount ??
            onboarding.filter((o) => o.review_status === 'new').length,
          totalOnboardingCount: raw?.stats?.totalOnboardingCount ?? onboarding.length,
        },
      });
    } catch (err) {
      console.error('Failed to read admin dashboard data:', err);
      res.status(500).json({ error: 'Failed to load admin dashboard data.' });
    }
  });

  app.patch('/api/admin/applications/:id', (req, res) => {
    const id = cleanStr(req.params.id, 80);
    const status = (req.body as { status?: unknown } | undefined)?.status;

    if (!id || (status !== 'approved' && status !== 'rejected' && status !== 'pending')) {
      res.status(400).json({
        error: 'Valid application ID and status (approved, rejected, or pending) are required.',
      });
      return;
    }

    const updated = updateApplicationStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }

    res.json({ updated: true, application: updated });
  });

  app.patch('/api/admin/onboarding/:id', (req, res) => {
    const id = cleanStr(req.params.id, 80);
    const reviewStatus = (req.body as { reviewStatus?: unknown } | undefined)?.reviewStatus;

    if (
      !id ||
      (reviewStatus !== 'new' &&
        reviewStatus !== 'scouting' &&
        reviewStatus !== 'approved_to_roster' &&
        reviewStatus !== 'archived')
    ) {
      res.status(400).json({
        error:
          'Valid onboarding ID and reviewStatus (new, scouting, approved_to_roster, or archived) are required.',
      });
      return;
    }

    const updated = updateOnboardingReviewStatus(id, reviewStatus as OnboardingReviewStatus);
    if (!updated) {
      res.status(404).json({ error: 'Onboarding record not found.' });
      return;
    }

    res.json({ updated: true, onboarding: updated });
  });

  app.use('/api/admin', (_req, res) => {
    res.status(404).json({ error: 'Admin endpoint not found.' });
  });

  const httpServer = http.createServer(app);

  if (!isProd) {
    const vitePromise: Promise<ViteDevServer> = import('vite').then(
      ({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
          },
          appType: 'spa',
        })
    );

    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
      vitePromise
        .then((vite) => {
          vite.middlewares(req, res, next);
        })
        .catch(next);
    });
  } else {
    const distFromDir = path.resolve(__dirname, 'dist');
    const distFromCwd = path.resolve(process.cwd(), 'dist');
    const distPath = fs.existsSync(path.join(distFromDir, 'index.html'))
      ? distFromDir
      : distFromCwd;

    if (fs.existsSync(distPath)) {
      const assetsDirPrefix = path.join(distPath, 'assets') + path.sep;

      app.use(
        express.static(distPath, {
          fallthrough: true,
          index: 'index.html',
          setHeaders(res, filePath) {
            if (filePath.endsWith('.html')) {
              res.setHeader('Cache-Control', 'no-cache');
            } else if (filePath.startsWith(assetsDirPrefix)) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          },
        })
      );

      // Missing /assets/* files must return 404 (never fall back to index.html)
      app.use('/assets', (_req, res) => {
        res.status(404).type('text/plain').send('Asset not found');
      });

      const STATIC_FILE_EXT_RE =
        /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|otf|json|txt|xml|pdf|mp4|webm)$/i;

      app.get('*', (req, res, next) => {
        if (
          req.path === '/api' ||
          req.path.startsWith('/api/') ||
          STATIC_FILE_EXT_RE.test(req.path)
        ) {
          res.status(404).json({ error: 'Not found.' });
          return;
        }

        const indexPath = path.join(distPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
          next(new Error('Production client build (dist/index.html) is missing.'));
          return;
        }

        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexPath, (err) => {
          if (err) {
            next(err);
          }
        });
      });
    } else {
      app.get('*', (req, res) => {
        if (req.path.startsWith('/assets/')) {
          res.status(404).type('text/plain').send('Asset not found');
          return;
        }
        res.status(503).json({
          error: 'Production client build not found. Run npm run build first.',
        });
      });
    }
  }

  // Final Express error-handling middleware so unhandled errors never corrupt static/API responses
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const statusCandidate =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : typeof err === 'object' &&
            err !== null &&
            'statusCode' in err &&
            typeof (err as { statusCode?: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;

    const status = statusCandidate >= 400 && statusCandidate < 600 ? statusCandidate : 500;
    const message =
      err instanceof Error && err.message ? err.message : 'Internal server error.';

    console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);

    if (res.headersSent) {
      return;
    }

    if (req.path.startsWith('/assets/')) {
      res.status(status).type('text/plain').send('Asset serving error');
      return;
    }

    res.status(status).json({
      error: isProd && status >= 500 ? 'Internal server error.' : message,
    });
  });

  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err);
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NYC Model Club server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

