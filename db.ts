import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isServerlessRuntime = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.CF_PAGES
);

function openSqliteDatabase(): { instance: Database.Database; dbPath: string; ephemeral: boolean } {
  const configuredPath = process.env.DATABASE_PATH?.trim();
  const preferredPath = configuredPath
    ? path.resolve(process.cwd(), configuredPath)
    : isServerlessRuntime
      ? path.join(os.tmpdir(), 'nyc_model_club.db')
      : path.join(__dirname, 'data', 'nyc_model_club.db');

  try {
    fs.mkdirSync(path.dirname(preferredPath), { recursive: true });
    const instance = new Database(preferredPath);
    const ephemeral = !configuredPath && isServerlessRuntime;
    if (ephemeral) {
      console.warn(
        `[db] Running in serverless environment without DATABASE_PATH; SQLite at ${preferredPath} is ephemeral across cold starts.`
      );
    }
    return { instance, dbPath: preferredPath, ephemeral };
  } catch (err) {
    const fallbackPath = path.join(os.tmpdir(), 'nyc_model_club.db');
    if (preferredPath !== fallbackPath) {
      console.warn(
        `[db] Unable to open SQLite at ${preferredPath}; falling back to ephemeral ${fallbackPath}.`,
        err
      );
      fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
      return { instance: new Database(fallbackPath), dbPath: fallbackPath, ephemeral: true };
    }
    throw err;
  }
}

const sqliteInit = openSqliteDatabase();
export const db = sqliteInit.instance;
export const isEphemeralSqlite = sqliteInit.ephemeral;
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    stripe_session_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    card_last4 TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
  CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at DESC);

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    package_label TEXT NOT NULL,
    base_rate_dollars REAL NOT NULL,
    client_fee_dollars REAL NOT NULL,
    model_commission_dollars REAL NOT NULL,
    total_client_charge_dollars REAL NOT NULL,
    model_net_payout_dollars REAL NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    shoot_date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_payment',
    stripe_session_id TEXT UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    borough TEXT NOT NULL,
    email TEXT NOT NULL,
    instagram TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);

  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    email TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS member_onboarding (
    id TEXT PRIMARY KEY,
    member_id TEXT,
    stripe_session_id TEXT UNIQUE,
    plan_id TEXT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    stage_name TEXT NOT NULL DEFAULT '',
    measurements TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    portfolio_url TEXT NOT NULL DEFAULT '',
    digitals_url TEXT NOT NULL DEFAULT '',
    studio_shoot_slot TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    company_role TEXT NOT NULL DEFAULT '',
    project_type TEXT NOT NULL DEFAULT '',
    review_status TEXT NOT NULL DEFAULT 'new',
    confirmation_notified_at TEXT,
    confirmation_channel TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON member_onboarding(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_onboarding_status ON member_onboarding(review_status);
`);

const bookingColumns = (
  db.prepare('PRAGMA table_info(bookings)').all() as Array<{ name: string }>
).map((col) => col.name);

if (!bookingColumns.includes('booking_scope')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN booking_scope TEXT NOT NULL DEFAULT 'model'`);
}
if (!bookingColumns.includes('production_package')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN production_package TEXT NOT NULL DEFAULT ''`);
}
if (!bookingColumns.includes('production_rate_dollars')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN production_rate_dollars REAL NOT NULL DEFAULT 0`);
}

const memberColumns = (
  db.prepare('PRAGMA table_info(members)').all() as Array<{ name: string }>
).map((col) => col.name);

if (!memberColumns.includes('webhook_verified')) {
  db.exec(`ALTER TABLE members ADD COLUMN webhook_verified INTEGER NOT NULL DEFAULT 0`);
}
if (!memberColumns.includes('date_of_birth')) {
  db.exec(`ALTER TABLE members ADD COLUMN date_of_birth TEXT NOT NULL DEFAULT ''`);
}
if (!memberColumns.includes('is_minor')) {
  db.exec(`ALTER TABLE members ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0`);
}
if (!memberColumns.includes('parent_name')) {
  db.exec(`ALTER TABLE members ADD COLUMN parent_name TEXT NOT NULL DEFAULT ''`);
}
if (!memberColumns.includes('parent_email')) {
  db.exec(`ALTER TABLE members ADD COLUMN parent_email TEXT NOT NULL DEFAULT ''`);
}
if (!memberColumns.includes('parent_phone')) {
  db.exec(`ALTER TABLE members ADD COLUMN parent_phone TEXT NOT NULL DEFAULT ''`);
}
if (!memberColumns.includes('parent_consent')) {
  db.exec(`ALTER TABLE members ADD COLUMN parent_consent INTEGER NOT NULL DEFAULT 0`);
}
if (!memberColumns.includes('profile_visibility')) {
  db.exec(`ALTER TABLE members ADD COLUMN profile_visibility TEXT NOT NULL DEFAULT 'public'`);
}
if (!memberColumns.includes('visibility_scope')) {
  db.exec(`ALTER TABLE members ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'public'`);
}

const applicationColumns = (
  db.prepare('PRAGMA table_info(applications)').all() as Array<{ name: string }>
).map((col) => col.name);

if (!applicationColumns.includes('is_minor')) {
  db.exec(`ALTER TABLE applications ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0`);
}
if (!applicationColumns.includes('parent_name')) {
  db.exec(`ALTER TABLE applications ADD COLUMN parent_name TEXT NOT NULL DEFAULT ''`);
}
if (!applicationColumns.includes('parent_email')) {
  db.exec(`ALTER TABLE applications ADD COLUMN parent_email TEXT NOT NULL DEFAULT ''`);
}
if (!applicationColumns.includes('parent_phone')) {
  db.exec(`ALTER TABLE applications ADD COLUMN parent_phone TEXT NOT NULL DEFAULT ''`);
}
if (!applicationColumns.includes('parent_consent')) {
  db.exec(`ALTER TABLE applications ADD COLUMN parent_consent INTEGER NOT NULL DEFAULT 0`);
}
if (!applicationColumns.includes('profile_visibility')) {
  db.exec(`ALTER TABLE applications ADD COLUMN profile_visibility TEXT NOT NULL DEFAULT 'public'`);
}
if (!applicationColumns.includes('date_of_birth')) {
  db.exec(`ALTER TABLE applications ADD COLUMN date_of_birth TEXT NOT NULL DEFAULT ''`);
}
if (!applicationColumns.includes('visibility_scope')) {
  db.exec(`ALTER TABLE applications ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'public'`);
}

db.exec(
  `UPDATE applications
   SET visibility_scope = 'verified_clients_only',
       profile_visibility = 'clients_only'
   WHERE (is_minor = 1 OR profile_visibility = 'clients_only')
     AND (visibility_scope != 'verified_clients_only' OR profile_visibility != 'clients_only')`
);

const onboardingColumns = (
  db.prepare('PRAGMA table_info(member_onboarding)').all() as Array<{ name: string }>
).map((col) => col.name);

if (!onboardingColumns.includes('is_minor')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0`);
}
if (!onboardingColumns.includes('parent_name')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN parent_name TEXT NOT NULL DEFAULT ''`);
}
if (!onboardingColumns.includes('parent_email')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN parent_email TEXT NOT NULL DEFAULT ''`);
}
if (!onboardingColumns.includes('parent_phone')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN parent_phone TEXT NOT NULL DEFAULT ''`);
}
if (!onboardingColumns.includes('parent_consent')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN parent_consent INTEGER NOT NULL DEFAULT 0`);
}
if (!onboardingColumns.includes('profile_visibility')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN profile_visibility TEXT NOT NULL DEFAULT 'public'`);
}
if (!onboardingColumns.includes('date_of_birth')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN date_of_birth TEXT NOT NULL DEFAULT ''`);
}
if (!onboardingColumns.includes('visibility_scope')) {
  db.exec(`ALTER TABLE member_onboarding ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'public'`);
}

db.exec(
  `UPDATE member_onboarding
   SET visibility_scope = 'verified_clients_only',
       profile_visibility = 'clients_only'
   WHERE (is_minor = 1 OR profile_visibility = 'clients_only')
     AND (visibility_scope != 'verified_clients_only' OR profile_visibility != 'clients_only')`
);

export interface MemberRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  plan_id: string;
  billing_cycle: string;
  amount_cents: number;
  status: string;
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
  card_last4: string | null;
  webhook_verified: number;
  date_of_birth: string;
  is_minor: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  parent_consent: number;
  profile_visibility: 'public' | 'clients_only';
  visibility_scope: 'public' | 'verified_clients_only';
  created_at: string;
}

export interface BookingRecord {
  id: string;
  booking_scope: 'model' | 'production' | 'bundle';
  model_id: string;
  model_name: string;
  package_label: string;
  production_package: string;
  base_rate_dollars: number;
  production_rate_dollars: number;
  client_fee_dollars: number;
  model_commission_dollars: number;
  total_client_charge_dollars: number;
  model_net_payout_dollars: number;
  client_name: string;
  client_email: string;
  shoot_date: string;
  notes: string;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
}

export interface ApplicationRecord {
  id: string;
  full_name: string;
  role: string;
  borough: string;
  email: string;
  instagram: string;
  date_of_birth: string;
  is_minor: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  parent_consent: number;
  profile_visibility: 'public' | 'clients_only';
  visibility_scope: 'public' | 'verified_clients_only';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface NewsletterRecord {
  email: string;
  created_at: string;
}

export type OnboardingReviewStatus = 'new' | 'scouting' | 'approved_to_roster' | 'archived';

export interface MemberOnboardingRecord {
  id: string;
  member_id: string | null;
  stripe_session_id: string | null;
  plan_id: 'talent' | 'studio' | 'clients';
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
  date_of_birth: string;
  is_minor: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  parent_consent: number;
  profile_visibility: 'public' | 'clients_only';
  visibility_scope: 'public' | 'verified_clients_only';
  review_status: OnboardingReviewStatus;
  confirmation_notified_at: string | null;
  confirmation_channel: string;
  created_at: string;
  updated_at: string;
}

export function upsertActiveMember(input: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  planId: string;
  billingCycle: string;
  amountCents: number;
  stripeSessionId?: string | null;
  stripeCustomerId?: string | null;
  cardLast4?: string | null;
  webhookVerified?: boolean;
  dateOfBirth?: string;
  isMinor?: boolean;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentConsent?: boolean;
  visibilityScope?: 'public' | 'verified_clients_only';
}): MemberRecord {
  const webhookVerifiedFlag = input.webhookVerified ? 1 : 0;
  const isMinorFlag = input.planId !== 'clients' && input.isMinor ? 1 : 0;
  const parentConsentFlag = isMinorFlag === 1 && input.parentConsent ? 1 : 0;
  const profileVisibility: 'public' | 'clients_only' =
    isMinorFlag === 1 ? 'clients_only' : 'public';
  const visibilityScope: 'public' | 'verified_clients_only' =
    isMinorFlag === 1 ? 'verified_clients_only' : input.visibilityScope || 'public';
  const dateOfBirth = input.planId !== 'clients' ? input.dateOfBirth || '' : '';

  const existingBySession = input.stripeSessionId
    ? (db
        .prepare('SELECT * FROM members WHERE stripe_session_id = ?')
        .get(input.stripeSessionId) as MemberRecord | undefined)
    : undefined;

  const existingByCustomer =
    !existingBySession && input.stripeCustomerId
      ? (db
          .prepare('SELECT * FROM members WHERE stripe_customer_id = ?')
          .get(input.stripeCustomerId) as MemberRecord | undefined)
      : undefined;

  const existing = existingBySession || existingByCustomer;
  if (existing) {
    db.prepare(
      `UPDATE members
       SET status = 'active',
           email = ?,
           full_name = ?,
           role = ?,
           plan_id = ?,
           billing_cycle = ?,
           amount_cents = ?,
           stripe_session_id = COALESCE(?, stripe_session_id),
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           webhook_verified = CASE WHEN ? = 1 THEN 1 ELSE webhook_verified END,
           date_of_birth = CASE WHEN ? != '' THEN ? ELSE date_of_birth END,
           is_minor = CASE WHEN ? != '' THEN ? ELSE is_minor END,
           parent_name = CASE WHEN ? != '' THEN ? ELSE parent_name END,
           parent_email = CASE WHEN ? != '' THEN ? ELSE parent_email END,
           parent_phone = CASE WHEN ? != '' THEN ? ELSE parent_phone END,
           parent_consent = CASE WHEN ? != '' THEN ? ELSE parent_consent END,
           profile_visibility = CASE WHEN ? != '' THEN ? ELSE profile_visibility END,
           visibility_scope = CASE WHEN ? != '' THEN ? ELSE visibility_scope END
       WHERE id = ?`
    ).run(
      input.email,
      input.fullName,
      input.role,
      input.planId,
      input.billingCycle,
      input.amountCents,
      input.stripeSessionId || null,
      input.stripeCustomerId || null,
      webhookVerifiedFlag,
      dateOfBirth,
      dateOfBirth,
      dateOfBirth,
      isMinorFlag,
      dateOfBirth,
      isMinorFlag === 1 ? input.parentName || '' : '',
      dateOfBirth,
      isMinorFlag === 1 ? input.parentEmail || '' : '',
      dateOfBirth,
      isMinorFlag === 1 ? input.parentPhone || '' : '',
      dateOfBirth,
      parentConsentFlag,
      dateOfBirth,
      profileVisibility,
      dateOfBirth,
      visibilityScope,
      existing.id
    );
    return db.prepare('SELECT * FROM members WHERE id = ?').get(existing.id) as MemberRecord;
  }

  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO members (
      id, email, full_name, role, plan_id, billing_cycle, amount_cents,
      status, stripe_session_id, stripe_customer_id, card_last4, webhook_verified,
      date_of_birth, is_minor, parent_name, parent_email, parent_phone,
      parent_consent, profile_visibility, visibility_scope, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.email,
    input.fullName,
    input.role,
    input.planId,
    input.billingCycle,
    input.amountCents,
    input.stripeSessionId || null,
    input.stripeCustomerId || null,
    input.cardLast4 || null,
    webhookVerifiedFlag,
    dateOfBirth,
    isMinorFlag,
    isMinorFlag === 1 ? input.parentName || '' : '',
    isMinorFlag === 1 ? input.parentEmail || '' : '',
    isMinorFlag === 1 ? input.parentPhone || '' : '',
    parentConsentFlag,
    profileVisibility,
    visibilityScope,
    createdAt
  );

  return db.prepare('SELECT * FROM members WHERE id = ?').get(input.id) as MemberRecord;
}

export function findMemberByStripeSession(sessionId: string): MemberRecord | undefined {
  return db
    .prepare('SELECT * FROM members WHERE stripe_session_id = ?')
    .get(sessionId) as MemberRecord | undefined;
}

export function cancelMemberByStripeCustomer(customerId: string): void {
  db.prepare(`UPDATE members SET status = 'cancelled' WHERE stripe_customer_id = ?`).run(customerId);
}

export function createBookingRecord(input: {
  id: string;
  bookingScope?: 'model' | 'production' | 'bundle';
  modelId: string;
  modelName: string;
  packageLabel: string;
  productionPackage?: string;
  baseRateDollars: number;
  productionRateDollars?: number;
  clientFeeDollars: number;
  modelCommissionDollars: number;
  totalClientChargeDollars: number;
  modelNetPayoutDollars: number;
  clientName: string;
  clientEmail: string;
  shootDate: string;
  notes: string;
  status: 'pending_payment' | 'paid';
  stripeSessionId?: string | null;
}): BookingRecord {
  const createdAt = new Date().toISOString();
  const bookingScope = input.bookingScope || 'model';
  const productionPackage = input.productionPackage || '';
  const productionRateDollars = input.productionRateDollars || 0;

  db.prepare(
    `INSERT INTO bookings (
      id, booking_scope, model_id, model_name, package_label, production_package,
      base_rate_dollars, production_rate_dollars,
      client_fee_dollars, model_commission_dollars, total_client_charge_dollars,
      model_net_payout_dollars, client_name, client_email, shoot_date,
      notes, status, stripe_session_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    bookingScope,
    input.modelId,
    input.modelName,
    input.packageLabel,
    productionPackage,
    input.baseRateDollars,
    productionRateDollars,
    input.clientFeeDollars,
    input.modelCommissionDollars,
    input.totalClientChargeDollars,
    input.modelNetPayoutDollars,
    input.clientName,
    input.clientEmail,
    input.shootDate,
    input.notes,
    input.status,
    input.stripeSessionId || null,
    createdAt
  );

  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(input.id) as BookingRecord;
}

export function markBookingPaidByStripeSession(
  sessionId: string,
  fallback?: {
    id: string;
    bookingScope?: 'model' | 'production' | 'bundle';
    modelId: string;
    modelName: string;
    packageLabel: string;
    productionPackage?: string;
    baseRateDollars: number;
    productionRateDollars?: number;
    clientFeeDollars: number;
    modelCommissionDollars: number;
    totalClientChargeDollars: number;
    modelNetPayoutDollars: number;
    clientName: string;
    clientEmail: string;
    shootDate: string;
    notes: string;
  }
): BookingRecord | undefined {
  const existing = db
    .prepare('SELECT * FROM bookings WHERE stripe_session_id = ?')
    .get(sessionId) as BookingRecord | undefined;
  if (existing) {
    db.prepare(`UPDATE bookings SET status = 'paid' WHERE stripe_session_id = ?`).run(sessionId);
    return db
      .prepare('SELECT * FROM bookings WHERE stripe_session_id = ?')
      .get(sessionId) as BookingRecord;
  }

  if (fallback) {
    return createBookingRecord({
      ...fallback,
      status: 'paid',
      stripeSessionId: sessionId,
    });
  }
  return undefined;
}

export function findBookingByStripeSession(sessionId: string): BookingRecord | undefined {
  return db
    .prepare('SELECT * FROM bookings WHERE stripe_session_id = ?')
    .get(sessionId) as BookingRecord | undefined;
}

export function createApplicationRecord(input: {
  id: string;
  fullName: string;
  role: string;
  borough: string;
  email: string;
  instagram: string;
  dateOfBirth?: string;
  isMinor?: boolean;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentConsent?: boolean;
  visibilityScope?: 'public' | 'verified_clients_only';
}): ApplicationRecord {
  const createdAt = new Date().toISOString();
  const isMinorFlag = input.isMinor ? 1 : 0;
  const parentConsentFlag = input.isMinor && input.parentConsent ? 1 : 0;
  const profileVisibility = input.isMinor ? 'clients_only' : 'public';
  const visibilityScope = input.isMinor
    ? 'verified_clients_only'
    : input.visibilityScope || 'public';

  db.prepare(
    `INSERT INTO applications (
      id, full_name, role, borough, email, instagram,
      date_of_birth, is_minor, parent_name, parent_email, parent_phone,
      parent_consent, profile_visibility, visibility_scope,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    input.id,
    input.fullName,
    input.role,
    input.borough,
    input.email,
    input.instagram,
    input.dateOfBirth || '',
    isMinorFlag,
    input.isMinor ? input.parentName || '' : '',
    input.isMinor ? input.parentEmail || '' : '',
    input.isMinor ? input.parentPhone || '' : '',
    parentConsentFlag,
    profileVisibility,
    visibilityScope,
    createdAt
  );

  return db.prepare('SELECT * FROM applications WHERE id = ?').get(input.id) as ApplicationRecord;
}

export function updateApplicationStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected'
): ApplicationRecord | undefined {
  const result = db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, id);
  if (result.changes === 0) return undefined;
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as ApplicationRecord;
}

export function addNewsletterSubscriber(email: string): NewsletterRecord {
  const createdAt = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email, created_at) VALUES (?, ?)').run(
    email,
    createdAt
  );
  return db
    .prepare('SELECT * FROM newsletter_subscribers WHERE email = ?')
    .get(email) as NewsletterRecord;
}

export function findMemberByEmailAndPlan(
  email: string,
  planId?: string
): MemberRecord | undefined {
  if (planId) {
    return db
      .prepare(
        `SELECT * FROM members WHERE lower(email) = lower(?) AND plan_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(email, planId) as MemberRecord | undefined;
  }
  return db
    .prepare(`SELECT * FROM members WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT 1`)
    .get(email) as MemberRecord | undefined;
}

export function findVerifiedClientMember(
  email: string,
  memberCode: string
): MemberRecord | undefined {
  return db
    .prepare(
      `SELECT * FROM members
       WHERE lower(email) = lower(?)
         AND upper(id) = upper(?)
         AND plan_id = 'clients'
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(email.trim(), memberCode.trim()) as MemberRecord | undefined;
}

export function findOnboardingByStripeSession(
  sessionId: string
): MemberOnboardingRecord | undefined {
  return db
    .prepare('SELECT * FROM member_onboarding WHERE stripe_session_id = ?')
    .get(sessionId) as MemberOnboardingRecord | undefined;
}

export function upsertMemberOnboarding(input: {
  id: string;
  memberId?: string | null;
  stripeSessionId?: string | null;
  planId: 'talent' | 'studio' | 'clients';
  billingCycle: 'monthly' | 'annual';
  email: string;
  fullName: string;
  stageName: string;
  measurements: string;
  location: string;
  portfolioUrl: string;
  digitalsUrl: string;
  studioShootSlot: string;
  companyName: string;
  companyRole: string;
  projectType: string;
  dateOfBirth?: string;
  isMinor?: boolean;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentConsent?: boolean;
  visibilityScope?: 'public' | 'verified_clients_only';
  confirmationNotifiedAt?: string | null;
  confirmationChannel?: string;
}): MemberOnboardingRecord {
  const now = new Date().toISOString();
  const isMinorFlag = input.planId !== 'clients' && input.isMinor ? 1 : 0;
  const parentConsentFlag = isMinorFlag === 1 && input.parentConsent ? 1 : 0;
  const profileVisibility = isMinorFlag === 1 ? 'clients_only' : 'public';
  const visibilityScope =
    isMinorFlag === 1
      ? 'verified_clients_only'
      : input.visibilityScope || 'public';
  const dateOfBirth = input.planId !== 'clients' ? input.dateOfBirth || '' : '';
  const existing = input.stripeSessionId
    ? findOnboardingByStripeSession(input.stripeSessionId)
    : undefined;

  if (existing) {
    db.prepare(
      `UPDATE member_onboarding
       SET member_id = COALESCE(?, member_id),
           plan_id = ?,
           billing_cycle = ?,
           email = ?,
           full_name = ?,
           stage_name = ?,
           measurements = ?,
           location = ?,
           portfolio_url = ?,
           digitals_url = ?,
           studio_shoot_slot = ?,
           company_name = ?,
           company_role = ?,
           project_type = ?,
           date_of_birth = ?,
           is_minor = ?,
           parent_name = ?,
           parent_email = ?,
           parent_phone = ?,
           parent_consent = ?,
           profile_visibility = ?,
           visibility_scope = ?,
           confirmation_notified_at = COALESCE(?, confirmation_notified_at),
           confirmation_channel = CASE WHEN ? != '' THEN ? ELSE confirmation_channel END,
           updated_at = ?
       WHERE id = ?`
    ).run(
      input.memberId || null,
      input.planId,
      input.billingCycle,
      input.email,
      input.fullName,
      input.stageName,
      input.measurements,
      input.location,
      input.portfolioUrl,
      input.digitalsUrl,
      input.studioShootSlot,
      input.companyName,
      input.companyRole,
      input.projectType,
      dateOfBirth,
      isMinorFlag,
      isMinorFlag === 1 ? input.parentName || '' : '',
      isMinorFlag === 1 ? input.parentEmail || '' : '',
      isMinorFlag === 1 ? input.parentPhone || '' : '',
      parentConsentFlag,
      profileVisibility,
      visibilityScope,
      input.confirmationNotifiedAt || null,
      input.confirmationChannel || '',
      input.confirmationChannel || '',
      now,
      existing.id
    );
    return db
      .prepare('SELECT * FROM member_onboarding WHERE id = ?')
      .get(existing.id) as MemberOnboardingRecord;
  }

  db.prepare(
    `INSERT INTO member_onboarding (
      id, member_id, stripe_session_id, plan_id, billing_cycle, email,
      full_name, stage_name, measurements, location, portfolio_url, digitals_url,
      studio_shoot_slot, company_name, company_role, project_type,
      date_of_birth, is_minor, parent_name, parent_email, parent_phone,
      parent_consent, profile_visibility, visibility_scope,
      review_status, confirmation_notified_at, confirmation_channel, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`
  ).run(
    input.id,
    input.memberId || null,
    input.stripeSessionId || null,
    input.planId,
    input.billingCycle,
    input.email,
    input.fullName,
    input.stageName,
    input.measurements,
    input.location,
    input.portfolioUrl,
    input.digitalsUrl,
    input.studioShootSlot,
    input.companyName,
    input.companyRole,
    input.projectType,
    dateOfBirth,
    isMinorFlag,
    isMinorFlag === 1 ? input.parentName || '' : '',
    isMinorFlag === 1 ? input.parentEmail || '' : '',
    isMinorFlag === 1 ? input.parentPhone || '' : '',
    parentConsentFlag,
    profileVisibility,
    visibilityScope,
    input.confirmationNotifiedAt || now,
    input.confirmationChannel || 'in_app_dispatch',
    now,
    now
  );

  return db
    .prepare('SELECT * FROM member_onboarding WHERE id = ?')
    .get(input.id) as MemberOnboardingRecord;
}

export function updateOnboardingNotification(
  id: string,
  channel: string,
  notifiedAt: string
): MemberOnboardingRecord | undefined {
  db.prepare(
    `UPDATE member_onboarding SET confirmation_channel = ?, confirmation_notified_at = ?, updated_at = ? WHERE id = ?`
  ).run(channel, notifiedAt, new Date().toISOString(), id);
  return db
    .prepare('SELECT * FROM member_onboarding WHERE id = ?')
    .get(id) as MemberOnboardingRecord | undefined;
}

export function updateOnboardingReviewStatus(
  id: string,
  reviewStatus: OnboardingReviewStatus
): MemberOnboardingRecord | undefined {
  const result = db
    .prepare('UPDATE member_onboarding SET review_status = ?, updated_at = ? WHERE id = ?')
    .run(reviewStatus, new Date().toISOString(), id);
  if (result.changes === 0) return undefined;
  return db
    .prepare('SELECT * FROM member_onboarding WHERE id = ?')
    .get(id) as MemberOnboardingRecord;
}

export function listApprovedOnboardingTalent(options?: { includeClientsOnly?: boolean }): Array<{
  id: string;
  fullName: string;
  stageName: string;
  measurements: string;
  location: string;
  portfolioUrl: string;
  digitalsUrl: string;
  planId: string;
  isMinor: boolean;
  profileVisibility: 'public' | 'clients_only';
  visibilityScope: 'public' | 'verified_clients_only';
  createdAt: string;
}> {
  const includeClientsOnly = Boolean(options?.includeClientsOnly);
  const query = includeClientsOnly
    ? `SELECT id, full_name, stage_name, measurements, location, portfolio_url, digitals_url, plan_id, is_minor, profile_visibility, visibility_scope, created_at
       FROM member_onboarding
       WHERE review_status = 'approved_to_roster' AND plan_id IN ('talent', 'studio')
       ORDER BY updated_at DESC`
    : `SELECT id, full_name, stage_name, measurements, location, portfolio_url, digitals_url, plan_id, is_minor, profile_visibility, visibility_scope, created_at
       FROM member_onboarding
       WHERE review_status = 'approved_to_roster'
         AND plan_id IN ('talent', 'studio')
         AND is_minor = 0
         AND profile_visibility = 'public'
         AND visibility_scope = 'public'
       ORDER BY updated_at DESC`;

  const rows = db.prepare(query).all() as Array<{
    id: string;
    full_name: string;
    stage_name: string;
    measurements: string;
    location: string;
    portfolio_url: string;
    digitals_url: string;
    plan_id: string;
    is_minor: number;
    profile_visibility: 'public' | 'clients_only';
    visibility_scope: 'public' | 'verified_clients_only';
    created_at: string;
  }>;

  const visibleRows = includeClientsOnly
    ? rows
    : rows.filter(
        (row) =>
          row.is_minor === 0 &&
          row.profile_visibility === 'public' &&
          row.visibility_scope === 'public'
      );

  return visibleRows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    stageName: row.stage_name,
    measurements: row.measurements,
    location: row.location,
    portfolioUrl: row.portfolio_url,
    digitalsUrl: row.digitals_url,
    planId: row.plan_id,
    isMinor: row.is_minor === 1,
    profileVisibility: row.is_minor === 1 ? 'clients_only' : row.profile_visibility || 'public',
    visibilityScope:
      row.is_minor === 1 || row.profile_visibility === 'clients_only'
        ? 'verified_clients_only'
        : row.visibility_scope || 'public',
    createdAt: row.created_at,
  }));
}

export function listApprovedDirectoryApplications(options?: {
  includeClientsOnly?: boolean;
}): Array<{
  id: string;
  fullName: string;
  role: string;
  borough: string;
  isMinor: boolean;
  profileVisibility: 'public' | 'clients_only';
  visibilityScope: 'public' | 'verified_clients_only';
  createdAt: string;
}> {
  const includeClientsOnly = Boolean(options?.includeClientsOnly);
  const query = includeClientsOnly
    ? `SELECT id, full_name, role, borough, is_minor, profile_visibility, visibility_scope, created_at
       FROM applications
       WHERE status = 'approved'
       ORDER BY created_at DESC`
    : `SELECT id, full_name, role, borough, is_minor, profile_visibility, visibility_scope, created_at
       FROM applications
       WHERE status = 'approved'
         AND is_minor = 0
         AND profile_visibility = 'public'
         AND visibility_scope = 'public'
       ORDER BY created_at DESC`;

  const rows = db.prepare(query).all() as Array<{
    id: string;
    full_name: string;
    role: string;
    borough: string;
    is_minor: number;
    profile_visibility: 'public' | 'clients_only';
    visibility_scope: 'public' | 'verified_clients_only';
    created_at: string;
  }>;

  const visibleRows = includeClientsOnly
    ? rows
    : rows.filter(
        (row) =>
          row.is_minor === 0 &&
          row.profile_visibility === 'public' &&
          row.visibility_scope === 'public'
      );

  return visibleRows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    borough: row.borough,
    isMinor: row.is_minor === 1,
    profileVisibility: row.is_minor === 1 ? 'clients_only' : row.profile_visibility || 'public',
    visibilityScope:
      row.is_minor === 1 || row.profile_visibility === 'clients_only'
        ? 'verified_clients_only'
        : row.visibility_scope || 'public',
    createdAt: row.created_at,
  }));
}

export function getAdminDashboardData() {
  const membersRaw = db
    .prepare('SELECT * FROM members ORDER BY created_at DESC')
    .all() as MemberRecord[];
  const bookingsRaw = db
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC')
    .all() as BookingRecord[];
  const applicationsRaw = db
    .prepare('SELECT * FROM applications ORDER BY created_at DESC')
    .all() as ApplicationRecord[];
  const newsletterRaw = db
    .prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC')
    .all() as NewsletterRecord[];
  const onboardingRaw = db
    .prepare('SELECT * FROM member_onboarding ORDER BY created_at DESC')
    .all() as MemberOnboardingRecord[];

  const members = Array.isArray(membersRaw) ? membersRaw : [];
  const bookings = Array.isArray(bookingsRaw) ? bookingsRaw : [];
  const applications = Array.isArray(applicationsRaw) ? applicationsRaw : [];
  const newsletterSubscribers = Array.isArray(newsletterRaw) ? newsletterRaw : [];
  const onboarding = Array.isArray(onboardingRaw) ? onboardingRaw : [];

  return {
    members,
    bookings,
    applications,
    newsletterSubscribers,
    onboarding,
    stats: {
      activeMembersCount: members.filter((m) => m.status === 'active').length,
      totalBookingsCount: bookings.length,
      paidBookingsCount: bookings.filter((b) => b.status === 'paid').length,
      pendingApplicationsCount: applications.filter((a) => a.status === 'pending').length,
      newsletterCount: newsletterSubscribers.length,
      newOnboardingCount: onboarding.filter((o) => o.review_status === 'new').length,
      totalOnboardingCount: onboarding.length,
    },
  };
}

