import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Lock, RefreshCw, Search, LogOut } from 'lucide-react';

interface AdminMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  plan_id: string;
  billing_cycle: string;
  amount_cents: number;
  status: string;
  stripe_session_id: string | null;
  date_of_birth?: string;
  is_minor?: number;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  parent_consent?: number;
  profile_visibility?: 'public' | 'clients_only';
  visibility_scope?: 'public' | 'verified_clients_only';
  created_at: string;
}

interface AdminBooking {
  id: string;
  booking_scope?: 'model' | 'production' | 'bundle';
  model_id: string;
  model_name: string;
  package_label: string;
  production_package?: string;
  base_rate_dollars: number;
  client_fee_dollars: number;
  model_commission_dollars: number;
  total_client_charge_dollars: number;
  model_net_payout_dollars: number;
  client_name: string;
  client_email: string;
  shoot_date: string;
  notes: string;
  status: string;
  created_at: string;
}

interface AdminApplication {
  id: string;
  full_name: string;
  role: string;
  borough: string;
  email: string;
  instagram: string;
  date_of_birth?: string;
  is_minor?: number;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  parent_consent?: number;
  profile_visibility?: 'public' | 'clients_only';
  visibility_scope?: 'public' | 'verified_clients_only';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface AdminNewsletter {
  email: string;
  created_at: string;
}

interface AdminOnboarding {
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
  date_of_birth?: string;
  is_minor?: number;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  parent_consent?: number;
  profile_visibility?: 'public' | 'clients_only';
  visibility_scope?: 'public' | 'verified_clients_only';
  review_status: 'new' | 'scouting' | 'approved_to_roster' | 'archived';
  confirmation_notified_at: string | null;
  confirmation_channel: string;
  created_at: string;
  updated_at: string;
}

interface AdminStats {
  activeMembersCount: number;
  totalBookingsCount: number;
  paidBookingsCount: number;
  pendingApplicationsCount: number;
  newsletterCount: number;
  newOnboardingCount: number;
  totalOnboardingCount: number;
}

interface AdminDataResponse {
  members?: AdminMember[];
  bookings?: AdminBooking[];
  applications?: AdminApplication[];
  newsletterSubscribers?: AdminNewsletter[];
  onboarding?: AdminOnboarding[];
  stats?: Partial<AdminStats>;
}

const DEFAULT_ADMIN_STATS: AdminStats = {
  activeMembersCount: 0,
  totalBookingsCount: 0,
  paidBookingsCount: 0,
  pendingApplicationsCount: 0,
  newsletterCount: 0,
  newOnboardingCount: 0,
  totalOnboardingCount: 0,
};

function normalizeAdminData(raw: unknown): AdminDataResponse & {
  members: AdminMember[];
  bookings: AdminBooking[];
  applications: AdminApplication[];
  newsletterSubscribers: AdminNewsletter[];
  onboarding: AdminOnboarding[];
  stats: AdminStats;
} {
  const obj =
    raw && typeof raw === 'object' ? (raw as Partial<AdminDataResponse>) : {};
  const members = Array.isArray(obj.members) ? obj.members : [];
  const bookings = Array.isArray(obj.bookings) ? obj.bookings : [];
  const applications = Array.isArray(obj.applications) ? obj.applications : [];
  const newsletterSubscribers = Array.isArray(obj.newsletterSubscribers)
    ? obj.newsletterSubscribers
    : [];
  const onboarding = Array.isArray(obj.onboarding) ? obj.onboarding : [];
  const rawStats = obj.stats ?? {};

  return {
    members,
    bookings,
    applications,
    newsletterSubscribers,
    onboarding,
    stats: {
      activeMembersCount:
        rawStats?.activeMembersCount ??
        members.filter((m) => m.status === 'active').length ??
        DEFAULT_ADMIN_STATS.activeMembersCount,
      totalBookingsCount:
        rawStats?.totalBookingsCount ??
        bookings.length ??
        DEFAULT_ADMIN_STATS.totalBookingsCount,
      paidBookingsCount:
        rawStats?.paidBookingsCount ??
        bookings.filter((b) => b.status === 'paid').length ??
        DEFAULT_ADMIN_STATS.paidBookingsCount,
      pendingApplicationsCount:
        rawStats?.pendingApplicationsCount ??
        applications.filter((a) => a.status === 'pending').length ??
        DEFAULT_ADMIN_STATS.pendingApplicationsCount,
      newsletterCount:
        rawStats?.newsletterCount ??
        newsletterSubscribers.length ??
        DEFAULT_ADMIN_STATS.newsletterCount,
      newOnboardingCount:
        rawStats?.newOnboardingCount ??
        onboarding.filter((o) => o.review_status === 'new').length ??
        DEFAULT_ADMIN_STATS.newOnboardingCount,
      totalOnboardingCount:
        rawStats?.totalOnboardingCount ??
        onboarding.length ??
        DEFAULT_ADMIN_STATS.totalOnboardingCount,
    },
  };
}

type AdminTab = 'onboarding' | 'members' | 'bookings' | 'applications' | 'newsletter';

interface AdminDashboardProps {
  onNavigateHome: () => void;
}

const EMAIL_STORAGE_KEY = 'nycmc_admin_email';
const PASS_STORAGE_KEY = 'nycmc_admin_password';

const PLAN_LABELS: Record<string, string> = {
  talent: 'Model & Talent ($29)',
  studio: 'Studio Access ($59)',
  clients: 'Clients & Agencies ($99)',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateHome }) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [adminEmail, setAdminEmail] = useState<string>(
    () => sessionStorage.getItem(EMAIL_STORAGE_KEY) || ''
  );
  const [adminPassword, setAdminPassword] = useState<string>(
    () => sessionStorage.getItem(PASS_STORAGE_KEY) || ''
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [data, setData] = useState<AdminDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('onboarding');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);
  const [updatingOnboardingId, setUpdatingOnboardingId] = useState<string | null>(null);
  const [previewDigital, setPreviewDigital] = useState<{
    name: string;
    src: string;
    meta: string;
  } | null>(null);

  const fetchAdminData = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setIsAuthenticated(false);
      setData(null);
      setAuthError('Please enter both your admin email and password.');
      return;
    }

    setLoading(true);
    setAuthError(null);
    setActionError(null);

    try {
      const res = await fetch('/api/admin/data', {
        headers: {
          'X-Admin-Email': trimmedEmail,
          'X-Admin-Password': password,
        },
      });
      const rawText = await res.text();
      let payload: (Partial<AdminDataResponse> & { error?: string }) | null = null;
      if (rawText.trim()) {
        try {
          payload = JSON.parse(rawText) as Partial<AdminDataResponse> & { error?: string };
        } catch {
          payload = null;
        }
      }

      if (!res.ok) {
        setIsAuthenticated(false);
        setData(null);
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(EMAIL_STORAGE_KEY);
          sessionStorage.removeItem(PASS_STORAGE_KEY);
          setAdminEmail('');
          setAdminPassword('');
        }
        setAuthError(payload?.error || 'Authentication failed.');
        return;
      }

      const hasValidAdminPayload =
        payload !== null &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        ('stats' in payload ||
          'members' in payload ||
          'onboarding' in payload ||
          'bookings' in payload ||
          'applications' in payload ||
          'newsletterSubscribers' in payload);

      if (!hasValidAdminPayload) {
        setIsAuthenticated(false);
        setData(null);
        setAuthError(
          'Admin API returned an invalid response. Ensure /api/* routes hit the backend server rather than index.html.'
        );
        return;
      }

      sessionStorage.setItem(EMAIL_STORAGE_KEY, trimmedEmail);
      sessionStorage.setItem(PASS_STORAGE_KEY, password);
      setAdminEmail(trimmedEmail);
      setAdminPassword(password);
      setIsAuthenticated(true);
      setData(normalizeAdminData(payload));
    } catch {
      setIsAuthenticated(false);
      setData(null);
      setAuthError('Unable to connect to the admin server endpoint.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminEmail && adminPassword) {
      void fetchAdminData(adminEmail, adminPassword);
    }
  }, [adminEmail, adminPassword, fetchAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('Please enter both your admin email and password.');
      return;
    }
    await fetchAdminData(emailInput.trim(), passwordInput);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(EMAIL_STORAGE_KEY);
    sessionStorage.removeItem(PASS_STORAGE_KEY);
    setAdminEmail('');
    setAdminPassword('');
    setEmailInput('');
    setPasswordInput('');
    setIsAuthenticated(false);
    setData(null);
    setAuthError(null);
  };

  const handleApplicationStatus = async (
    id: string,
    nextStatus: 'approved' | 'rejected' | 'pending'
  ) => {
    if (!isAuthenticated || !adminEmail || !adminPassword) return;
    setUpdatingAppId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': adminEmail,
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(EMAIL_STORAGE_KEY);
          sessionStorage.removeItem(PASS_STORAGE_KEY);
          setIsAuthenticated(false);
          setData(null);
          setAdminEmail('');
          setAdminPassword('');
          setAuthError(payload.error || 'Session expired. Please sign in again.');
          return;
        }
        setActionError(payload.error || 'Failed to update application status.');
        return;
      }

      setData((prev) => {
        if (!prev) return prev;
        const currentApplications = prev.applications ?? [];
        const updatedApps = currentApplications.map((app) =>
          app.id === id ? { ...app, status: nextStatus } : app
        );
        return {
          ...prev,
          applications: updatedApps,
          stats: {
            ...DEFAULT_ADMIN_STATS,
            ...(prev.stats ?? {}),
            pendingApplicationsCount: updatedApps.filter((a) => a.status === 'pending').length,
          },
        };
      });
    } catch {
      setActionError('Network error updating application.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleOnboardingReviewStatus = async (
    id: string,
    reviewStatus: AdminOnboarding['review_status']
  ) => {
    if (!isAuthenticated || !adminEmail || !adminPassword) return;
    setUpdatingOnboardingId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/onboarding/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': adminEmail,
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify({ reviewStatus }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(EMAIL_STORAGE_KEY);
          sessionStorage.removeItem(PASS_STORAGE_KEY);
          setIsAuthenticated(false);
          setData(null);
          setAdminEmail('');
          setAdminPassword('');
          setAuthError(payload.error || 'Session expired. Please sign in again.');
          return;
        }
        setActionError(payload.error || 'Failed to update onboarding review status.');
        return;
      }

      setData((prev) => {
        if (!prev) return prev;
        const currentOnboarding = prev.onboarding ?? [];
        const updatedOnboarding = currentOnboarding.map((item) =>
          item.id === id ? { ...item, review_status: reviewStatus } : item
        );
        return {
          ...prev,
          onboarding: updatedOnboarding,
          stats: {
            ...DEFAULT_ADMIN_STATS,
            ...(prev.stats ?? {}),
            newOnboardingCount: updatedOnboarding.filter((o) => o.review_status === 'new').length,
            totalOnboardingCount: updatedOnboarding.length,
          },
        };
      });
    } catch {
      setActionError('Network error updating onboarding profile.');
    } finally {
      setUpdatingOnboardingId(null);
    }
  };

  const q = searchQuery.trim().toLowerCase();

  const onboardingList = data?.onboarding ?? [];
  const membersList = data?.members ?? [];
  const bookingsList = data?.bookings ?? [];
  const applicationsList = data?.applications ?? [];
  const newsletterList = data?.newsletterSubscribers ?? [];

  const safeStats: AdminStats = {
    newOnboardingCount: data?.stats?.newOnboardingCount ?? 0,
    totalOnboardingCount: data?.stats?.totalOnboardingCount ?? onboardingList.length,
    activeMembersCount: data?.stats?.activeMembersCount ?? 0,
    totalBookingsCount: data?.stats?.totalBookingsCount ?? bookingsList.length,
    paidBookingsCount: data?.stats?.paidBookingsCount ?? 0,
    pendingApplicationsCount: data?.stats?.pendingApplicationsCount ?? 0,
    newsletterCount: data?.stats?.newsletterCount ?? newsletterList.length,
  };

  const filteredOnboarding = useMemo(() => {
    const list = data?.onboarding ?? [];
    if (!q) return list;
    return list.filter(
      (o) =>
        (o.full_name ?? '').toLowerCase().includes(q) ||
        (o.stage_name ?? '').toLowerCase().includes(q) ||
        (o.company_name ?? '').toLowerCase().includes(q) ||
        (o.email ?? '').toLowerCase().includes(q) ||
        (o.location ?? '').toLowerCase().includes(q) ||
        (o.plan_id ?? '').toLowerCase().includes(q) ||
        (o.review_status ?? '').toLowerCase().includes(q)
    );
  }, [data, q]);

  const filteredMembers = useMemo(() => {
    const list = data?.members ?? [];
    if (!q) return list;
    return list.filter(
      (m) =>
        (m.full_name ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.plan_id ?? '').toLowerCase().includes(q) ||
        (m.id ?? '').toLowerCase().includes(q)
    );
  }, [data, q]);

  const filteredBookings = useMemo(() => {
    const list = data?.bookings ?? [];
    if (!q) return list;
    return list.filter(
      (b) =>
        (b.model_name ?? '').toLowerCase().includes(q) ||
        (b.client_name ?? '').toLowerCase().includes(q) ||
        (b.client_email ?? '').toLowerCase().includes(q) ||
        (b.id ?? '').toLowerCase().includes(q)
    );
  }, [data, q]);

  const filteredApplications = useMemo(() => {
    const list = data?.applications ?? [];
    if (!q) return list;
    return list.filter(
      (a) =>
        (a.full_name ?? '').toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        (a.borough ?? '').toLowerCase().includes(q) ||
        (a.role ?? '').toLowerCase().includes(q) ||
        (a.status ?? '').toLowerCase().includes(q)
    );
  }, [data, q]);

  const filteredNewsletter = useMemo(() => {
    const list = data?.newsletterSubscribers ?? [];
    if (!q) return list;
    return list.filter((n) => (n.email ?? '').toLowerCase().includes(q));
  }, [data, q]);

  if (!isAuthenticated || !adminEmail || !adminPassword || !data) {
    return (
      <div className="min-h-screen bg-white text-black flex flex-col">
        <header className="border-b border-neutral-200 h-14 px-6 md:px-10 flex items-center justify-between gap-8">
          <div className="flex items-baseline gap-3 whitespace-nowrap shrink-0">
            <span className="font-display font-extrabold text-xl tracking-[-0.04em]">
              nyc model club.
            </span>
            <span className="text-xs text-neutral-400">/</span>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-600">
              Admin Desk
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-black whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Site</span>
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md border border-black bg-white p-8 md:p-10">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-neutral-500">
              <Lock className="w-3.5 h-3.5 text-black" aria-hidden="true" />
              <span>Protected Agency Desk</span>
            </div>
            <h1 className="font-editorial italic text-3xl mt-2 text-black">
              Administration Sign In.
            </h1>
            <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
              Sign in with your agency administrator email and password to inspect paid members,
              online model bookings, talent applications, and dispatch subscribers.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="admin-email-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                >
                  Admin Email
                </label>
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@nycmodelclub.com"
                  className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
                >
                  Admin Password
                </label>
                <input
                  id="admin-password-input"
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-3.5 py-2.5 border border-neutral-300 text-sm focus:border-black focus:outline-none"
                />
              </div>

              {authError && (
                <p className="text-xs text-red-600 font-medium" role="alert">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying Credentials...' : 'Unlock Admin Desk'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between gap-8">
          <div className="flex items-baseline gap-3 whitespace-nowrap shrink-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome();
              }}
              className="font-display font-extrabold text-xl tracking-[-0.04em] text-black"
            >
              nyc model club.
            </a>
            <span className="text-xs text-neutral-400">/</span>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-600">
              Admin Desk
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void fetchAdminData(adminEmail, adminPassword)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 text-xs font-medium text-black hover:border-black transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 text-xs font-medium text-black hover:border-black transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Site</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 md:px-10 py-10">
        {/* Heading */}
        <div className="pb-8 border-b border-neutral-200 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Agency &amp; Club Operations Ledger
            </p>
            <h1 className="font-editorial italic text-4xl md:text-5xl text-black mt-1">
              Club &amp; Management Operations.
            </h1>
          </div>

          <div className="relative w-full md:w-72">
            <Search
              className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter name, email, ID..."
              aria-label="Filter admin records"
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 text-xs focus:border-black focus:outline-none"
            />
          </div>
        </div>

        {/* 5 Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 border-x border-b border-neutral-200 divide-y lg:divide-y-0 divide-x divide-neutral-200">
          <div className="p-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
              New Onboarding
            </p>
            <p className="font-display font-bold text-3xl text-black mt-2 tabular-nums">
              {safeStats.totalOnboardingCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 tabular-nums">
              {safeStats.newOnboardingCount} awaiting scout
            </p>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
              Paid Members
            </p>
            <p className="font-display font-bold text-3xl text-black mt-2 tabular-nums">
              {membersList.length}
            </p>
            <p className="text-xs text-neutral-500 mt-1 tabular-nums">
              {safeStats.activeMembersCount} active passes
            </p>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
              Model Bookings
            </p>
            <p className="font-display font-bold text-3xl text-black mt-2 tabular-nums">
              {safeStats.totalBookingsCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1 tabular-nums">
              {safeStats.paidBookingsCount} paid online
            </p>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
              Talent Applications
            </p>
            <p className="font-display font-bold text-3xl text-black mt-2 tabular-nums">
              {applicationsList.length}
            </p>
            <p className="text-xs text-neutral-500 mt-1 tabular-nums">
              {safeStats.pendingApplicationsCount} pending review
            </p>
          </div>
          <div className="p-6 col-span-2 lg:col-span-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
              Dispatch Subscribers
            </p>
            <p className="font-display font-bold text-3xl text-black mt-2 tabular-nums">
              {safeStats.newsletterCount}
            </p>
            <p className="text-xs text-neutral-500 mt-1">Newsletter list</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap items-center gap-1 p-1 bg-neutral-100 border border-neutral-200 w-fit">
          {(
            [
              {
                id: 'onboarding',
                label: `New Members & Onboarding (${filteredOnboarding.length})`,
              },
              { id: 'members', label: `Paid Members (${filteredMembers.length})` },
              { id: 'bookings', label: `Model Bookings (${filteredBookings.length})` },
              { id: 'applications', label: `Talent Applications (${filteredApplications.length})` },
              { id: 'newsletter', label: `Newsletter (${filteredNewsletter.length})` },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                  active ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {actionError && (
          <p className="mt-4 text-xs text-red-600 font-medium" role="alert">
            {actionError}
          </p>
        )}

        {/* Data Tables */}
        <div className="mt-6 border border-neutral-200 overflow-x-auto">
          {activeTab === 'onboarding' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-medium">Ref / Tier</th>
                  <th className="py-3 px-4 font-medium">Member / Company</th>
                  <th className="py-3 px-4 font-medium">Profile &amp; Digitals</th>
                  <th className="py-3 px-4 font-medium">Studio Shoot / Project</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Agency Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredOnboarding.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-neutral-500">
                      No onboarding profiles submitted yet. Post-payment submissions from
                      /onboarding appear here immediately.
                    </td>
                  </tr>
                ) : (
                  filteredOnboarding.map((ob) => {
                    const isUpdating = updatingOnboardingId === ob.id;
                    const isClient = ob.plan_id === 'clients';
                    const displayTitle = isClient
                      ? ob.company_name || ob.full_name
                      : ob.stage_name
                        ? `${ob.full_name} (${ob.stage_name})`
                        : ob.full_name;

                    return (
                      <tr key={ob.id} className="hover:bg-neutral-50 transition-colors align-top">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-black font-semibold block">{ob.id}</span>
                          <span className="text-[11px] text-neutral-600 block mt-0.5">
                            {PLAN_LABELS[ob.plan_id] || ob.plan_id}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 uppercase block">
                            {ob.billing_cycle}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-black block">{displayTitle}</span>
                          <span className="text-[11px] text-neutral-600 block">{ob.email}</span>
                          {ob.location && (
                            <span className="text-[11px] text-neutral-500 block">{ob.location}</span>
                          )}
                          {ob.date_of_birth && (
                            <span className="text-[11px] font-mono text-neutral-500 block">
                              DOB: {ob.date_of_birth}
                            </span>
                          )}
                          {(ob.is_minor === 1 ||
                            ob.profile_visibility === 'clients_only' ||
                            ob.visibility_scope === 'verified_clients_only') && (
                            <div className="mt-1 px-2 py-1 border border-black bg-neutral-100 text-[10px] font-mono text-black">
                              <span className="block font-semibold uppercase">
                                Minor (Parent Required)
                              </span>
                              <span className="block text-neutral-600">
                                Visibility: Verified Clients &amp; Agencies Only
                              </span>
                              {ob.parent_name && (
                                <span className="block text-neutral-700">
                                  Parent: {ob.parent_name} ({ob.parent_email} · {ob.parent_phone})
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                            {formatDate(ob.created_at)}
                            {ob.confirmation_notified_at ? ' · Notified' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isClient ? (
                            <div className="space-y-0.5">
                              <span className="text-black font-medium block">
                                {ob.company_role}
                              </span>
                              {ob.full_name && ob.full_name !== ob.company_name && (
                                <span className="text-[11px] text-neutral-500 block">
                                  Contact: {ob.full_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              {ob.digitals_url && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDigital({
                                      name: displayTitle,
                                      src: ob.digitals_url,
                                      meta: `${ob.measurements} · ${ob.location}`,
                                    })
                                  }
                                  className="shrink-0 border border-neutral-300 hover:border-black transition-colors cursor-pointer"
                                  title="Inspect headshot"
                                >
                                  <img
                                    src={ob.digitals_url}
                                    alt={displayTitle}
                                    className="w-10 h-12 object-cover"
                                  />
                                </button>
                              )}
                              <div className="space-y-0.5 min-w-0">
                                {ob.measurements && (
                                  <span className="text-black block">{ob.measurements}</span>
                                )}
                                {ob.portfolio_url && (
                                  <span className="text-[11px] font-mono text-neutral-600 block truncate max-w-[220px]">
                                    {ob.portfolio_url}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-neutral-700 max-w-[220px]">
                          {ob.plan_id === 'studio' && ob.studio_shoot_slot ? (
                            <span>{ob.studio_shoot_slot}</span>
                          ) : isClient && ob.project_type ? (
                            <span>{ob.project_type}</span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono uppercase text-[11px] whitespace-nowrap">
                          {ob.review_status === 'approved_to_roster'
                            ? 'Roster Approved'
                            : ob.review_status}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center border border-neutral-300 divide-x divide-neutral-300">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void handleOnboardingReviewStatus(
                                  ob.id,
                                  ob.review_status === 'scouting' ? 'new' : 'scouting'
                                )
                              }
                              className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                                ob.review_status === 'scouting'
                                  ? 'bg-neutral-800 text-white'
                                  : 'bg-white text-black hover:bg-neutral-100'
                              }`}
                            >
                              Scout
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void handleOnboardingReviewStatus(
                                  ob.id,
                                  ob.review_status === 'approved_to_roster'
                                    ? 'new'
                                    : 'approved_to_roster'
                                )
                              }
                              className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                                ob.review_status === 'approved_to_roster'
                                  ? 'bg-black text-white'
                                  : 'bg-white text-black hover:bg-neutral-100'
                              }`}
                            >
                              {ob.review_status === 'approved_to_roster'
                                ? 'On Roster'
                                : 'Approve Roster'}
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void handleOnboardingReviewStatus(
                                  ob.id,
                                  ob.review_status === 'archived' ? 'new' : 'archived'
                                )
                              }
                              className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                                ob.review_status === 'archived'
                                  ? 'bg-neutral-700 text-white'
                                  : 'bg-white text-neutral-500 hover:bg-neutral-100 hover:text-black'
                              }`}
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
          {activeTab === 'members' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-medium">Pass ID</th>
                  <th className="py-3 px-4 font-medium">Member</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium">Plan Tier</th>
                  <th className="py-3 px-4 font-medium">Billing</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center text-neutral-500">
                      No paid members recorded yet. Completed Stripe memberships appear here
                      automatically.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-black whitespace-nowrap">{m.id}</td>
                      <td className="py-3 px-4 font-medium text-black">
                        {m.full_name}
                        <span className="block text-[11px] text-neutral-500 font-normal">
                          {m.role}
                        </span>
                        {m.date_of_birth && (
                          <span className="block text-[11px] font-mono text-neutral-500 font-normal">
                            DOB: {m.date_of_birth}
                          </span>
                        )}
                        {(m.is_minor === 1 ||
                          m.profile_visibility === 'clients_only' ||
                          m.visibility_scope === 'verified_clients_only') && (
                          <div className="mt-1 px-2 py-1 border border-black bg-neutral-100 text-[10px] font-mono text-black font-normal">
                            <span className="block font-semibold uppercase">
                              Minor (Parent Required)
                            </span>
                            <span className="block text-neutral-600">
                              Visibility: Verified Clients &amp; Agencies Only
                            </span>
                            {m.parent_name && (
                              <span className="block text-neutral-700">
                                Parent: {m.parent_name} ({m.parent_email} · {m.parent_phone})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-700">{m.email}</td>
                      <td className="py-3 px-4 text-black">
                        {PLAN_LABELS[m.plan_id] || m.plan_id}
                      </td>
                      <td className="py-3 px-4 capitalize text-neutral-600">{m.billing_cycle}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-black">
                        ${((m.amount_cents ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-[11px]">
                        {m.status === 'active' ? 'Active' : m.status}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-neutral-500 whitespace-nowrap">
                        {formatDate(m.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'bookings' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-medium">Ref</th>
                  <th className="py-3 px-4 font-medium">Talent</th>
                  <th className="py-3 px-4 font-medium">Package</th>
                  <th className="py-3 px-4 font-medium">Client</th>
                  <th className="py-3 px-4 font-medium">Shoot Date</th>
                  <th className="py-3 px-4 font-medium text-right">Client Total (+20%)</th>
                  <th className="py-3 px-4 font-medium text-right">Model Net (-20%)</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 px-4 text-center text-neutral-500">
                      No model bookings recorded yet. Online bookings from New York City Model
                      Management appear here.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-black whitespace-nowrap">{b.id}</td>
                      <td className="py-3 px-4 font-medium text-black">
                        {b.model_name}
                        <span className="block text-[11px] font-normal text-neutral-500">
                          {b.booking_scope === 'production'
                            ? 'Media Production Only'
                            : b.booking_scope === 'bundle'
                              ? 'Bundle: Model + Media'
                              : 'Models Only'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-700">{b.package_label}</td>
                      <td className="py-3 px-4 text-black">
                        {b.client_name}
                        <span className="block text-[11px] text-neutral-500">{b.client_email}</span>
                      </td>
                      <td className="py-3 px-4 text-neutral-600">{b.shoot_date}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-black">
                        ${(b.total_client_charge_dollars ?? 0).toLocaleString()}.00
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-neutral-600">
                        ${(b.model_net_payout_dollars ?? 0).toLocaleString()}.00
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-[11px]">
                        {b.status === 'paid' ? 'Paid' : 'Pending'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-neutral-500 whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'applications' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Applicant</th>
                  <th className="py-3 px-4 font-medium">Discipline</th>
                  <th className="py-3 px-4 font-medium">Borough</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Review Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center text-neutral-500">
                      No talent applications submitted yet.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => {
                    const isUpdating = updatingAppId === app.id;
                    return (
                      <tr key={app.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-black whitespace-nowrap">
                          {app.id}
                        </td>
                        <td className="py-3 px-4 font-medium text-black">
                          {app.full_name}
                          {app.date_of_birth && (
                            <span className="block text-[11px] font-mono text-neutral-500 font-normal">
                              DOB: {app.date_of_birth}
                            </span>
                          )}
                          {(app.is_minor === 1 ||
                            app.profile_visibility === 'clients_only' ||
                            app.visibility_scope === 'verified_clients_only') && (
                            <div className="mt-1 px-2 py-1 border border-black bg-neutral-100 text-[10px] font-mono text-black font-normal">
                              <span className="block font-semibold uppercase">
                                Minor (Parent Required)
                              </span>
                              <span className="block text-neutral-600">
                                Visibility: Verified Clients &amp; Agencies Only
                              </span>
                              {app.parent_name && (
                                <span className="block text-neutral-700">
                                  Parent: {app.parent_name} ({app.parent_email} · {app.parent_phone})
                                </span>
                              )}
                            </div>
                          )}
                          <span className="block text-[11px] text-neutral-500 font-normal">
                            {formatDate(app.created_at)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-700">{app.role}</td>
                        <td className="py-3 px-4 text-neutral-600">{app.borough}</td>
                        <td className="py-3 px-4 text-neutral-700">
                          {app.email}
                          {app.instagram && (
                            <span className="block text-[11px] font-mono text-neutral-500">
                              {app.instagram}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono uppercase text-[11px]">
                          {app.status}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center border border-neutral-300 divide-x divide-neutral-300">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void handleApplicationStatus(
                                  app.id,
                                  app.status === 'approved' ? 'pending' : 'approved'
                                )
                              }
                              className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                                app.status === 'approved'
                                  ? 'bg-black text-white'
                                  : 'bg-white text-black hover:bg-neutral-100'
                              }`}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                void handleApplicationStatus(
                                  app.id,
                                  app.status === 'rejected' ? 'pending' : 'rejected'
                                )
                              }
                              className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                                app.status === 'rejected'
                                  ? 'bg-neutral-900 text-white'
                                  : 'bg-white text-neutral-600 hover:bg-neutral-100 hover:text-black'
                              }`}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'newsletter' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-medium">Subscriber Email</th>
                  <th className="py-3 px-4 font-medium text-right">Subscribed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredNewsletter.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-10 px-4 text-center text-neutral-500">
                      No newsletter subscribers yet.
                    </td>
                  </tr>
                ) : (
                  filteredNewsletter.map((sub) => (
                    <tr key={sub.email} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-black">{sub.email}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right text-neutral-500">
                        {formatDate(sub.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {previewDigital && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Digital headshot preview"
          onClick={() => setPreviewDigital(null)}
        >
          <div
            className="bg-white text-black border border-black max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-neutral-200">
              <div>
                <p className="font-display font-bold text-base text-black">{previewDigital.name}</p>
                <p className="text-xs text-neutral-500">{previewDigital.meta}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDigital(null)}
                className="px-3 py-1 border border-neutral-300 text-xs font-semibold hover:border-black cursor-pointer"
              >
                Close
              </button>
            </div>
            <img
              src={previewDigital.src}
              alt={previewDigital.name}
              className="mt-4 w-full max-h-[65vh] object-contain bg-neutral-100 border border-neutral-200"
            />
          </div>
        </div>
      )}
    </div>
  );
};
