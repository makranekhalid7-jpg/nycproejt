import React, { useEffect, useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import {
  CONTACT_CONFIG,
  CreativeRoleId,
  DIRECTORY_MEMBERS,
  DirectoryMember,
  EditorialStory,
  ROLE_OPTIONS,
  SocialFrame,
  calculateExactAge,
} from '../data/clubData';
import { EditorialPlate } from './EditorialPlate';

interface JoinDirectoryModalProps {
  open: boolean;
  defaultRole?: CreativeRoleId;
  clientAccessUnlocked?: boolean;
  directoryMembers?: DirectoryMember[];
  onClose: () => void;
  onProceedToMembership: () => void;
}

export const JoinDirectoryModal: React.FC<JoinDirectoryModalProps> = ({
  open,
  defaultRole = 'model',
  clientAccessUnlocked = false,
  directoryMembers,
  onClose,
  onProceedToMembership,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(
    ROLE_OPTIONS.find((r) => r.id === defaultRole)?.label || 'Model'
  );
  const [borough, setBorough] = useState('Manhattan, NY');
  const [instagram, setInstagram] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentConsent, setParentConsent] = useState(false);
  const [submittedAsMinor, setSubmittedAsMinor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [directoryFilter, setDirectoryFilter] = useState('');

  useEffect(() => {
    if (open) {
      setRole(ROLE_OPTIONS.find((r) => r.id === defaultRole)?.label || 'Model');
      setCreatedId(null);
      setErrorMsg(null);
      setSubmittedAsMinor(false);
    }
  }, [open, defaultRole]);

  if (!open) return null;

  const calculatedAge = calculateExactAge(dateOfBirth);
  const isMinor = calculatedAge !== null && calculatedAge < 18;
  const todayIso = new Date().toISOString().slice(0, 10);

  const baseMembers = directoryMembers || DIRECTORY_MEMBERS;
  const visibleDirectoryMembers = baseMembers.filter(
    (m) =>
      clientAccessUnlocked ||
      (!m.isMinor &&
        m.visibility !== 'clients_only' &&
        m.visibilityScope !== 'verified_clients_only')
  );

  const filteredMembers = visibleDirectoryMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(directoryFilter.toLowerCase()) ||
      m.role.toLowerCase().includes(directoryFilter.toLowerCase()) ||
      m.location.toLowerCase().includes(directoryFilter.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
          'Please confirm parent consent and private Clients & Agencies visibility.'
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          role,
          borough,
          instagram,
          dateOfBirth,
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
        setErrorMsg(data.error || 'Submission failed.');
        setSubmitting(false);
        return;
      }
      setSubmittedAsMinor(isMinor);
      setCreatedId(data.profileId);
    } catch {
      setErrorMsg('Network error submitting application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-modal-title"
    >
      <div className="bg-white text-black border border-black w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
            NYC Model Club · Open to All Models · Application &amp; Directory
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-neutral-500 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 id="join-modal-title" className="font-display font-bold text-2xl tracking-tight">
              Apply to NYC Model Club
            </h3>
            <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
              NYC Model Club is Open to All Models applying and paying the membership fee. Submit
              your application details below, then activate your Stripe membership pass.
            </p>

            <div className="mt-3 p-3 border border-black bg-neutral-50 space-y-1">
              <span className="inline-block px-2 py-0.5 bg-black text-white font-mono text-[10px] font-semibold uppercase tracking-wider">
                Discounted Pre-Sale / Early Bird Prices
              </span>
              <p className="text-[11px] text-neutral-700 leading-snug">
                Regular membership starts at $35/month starting February 2027.
              </p>
            </div>

            {createdId ? (
              <div className="mt-6 p-5 border border-black bg-neutral-50 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Application Registered ({createdId})</span>
                </div>
                <p className="text-xs text-neutral-600">
                  {submittedAsMinor
                    ? `Minor profile queued for ${fullName} under parent registration. This profile is marked private/restricted and hidden from all public pages, visible exclusively to verified Clients & Agencies.`
                    : `Your creative profile is queued for ${fullName}. Complete your Club Membership fee via Stripe to unlock instant directory publication and castings.`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onProceedToMembership();
                  }}
                  className="w-full py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  Pay Membership Fee ($29/mo · Early Bird)
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
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
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@studio.nyc"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 focus:border-black focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Discipline
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:border-black focus:outline-none"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Borough
                    </label>
                    <select
                      value={borough}
                      onChange={(e) => setBorough(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 bg-white focus:border-black focus:outline-none"
                    >
                      <option value="Manhattan, NY">Manhattan, NY</option>
                      <option value="Brooklyn, NY">Brooklyn, NY</option>
                      <option value="Queens, NY">Queens, NY</option>
                      <option value="Bronx, NY">Bronx, NY</option>
                      <option value="Staten Island, NY">Staten Island, NY</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Instagram or Portfolio URL
                  </label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@username or portfolio link"
                    className="w-full px-3 py-2 text-sm border border-neutral-300 focus:border-black focus:outline-none"
                  />
                </div>

                {/* Required Date of Birth & Automatic Under-18 Privacy Rules */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
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
                  {calculatedAge !== null && (
                    <p className="mt-1 font-mono text-[11px] text-neutral-700">
                      {isMinor
                        ? `Calculated Age: ${calculatedAge} · Minor Detected · Visibility: Verified Clients & Agencies Only`
                        : `Calculated Age: ${calculatedAge} · Standard Public Directory Eligibility`}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                    Applicants under 18 must be registered by a parent and are automatically
                    restricted from all public Roster &amp; Directory pages.
                  </p>
                </div>

                {isMinor && (
                  <div className="border border-black bg-neutral-50 p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-black leading-snug">
                      Parent Registration Required (Under 18)
                    </p>
                    <p className="text-[11px] text-neutral-600 leading-relaxed">
                      Profile visibility is locked to verified Clients &amp; Agencies only and hidden
                      from public pages.
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
                    <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        required
                        checked={parentConsent}
                        onChange={(e) => setParentConsent(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 accent-black shrink-0"
                      />
                      <span className="text-[11px] text-neutral-700 leading-snug">
                        I confirm I am the parent registering this minor and give consent for
                        private visibility restricted to verified Clients &amp; Agencies. *
                      </span>
                    </label>
                  </div>
                )}

                {errorMsg && (
                  <p className="text-xs text-red-600 font-medium" role="alert">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Club Application'}
                </button>
              </form>
            )}
          </div>

          <div className="border-t md:border-t-0 md:border-l border-neutral-200 pt-6 md:pt-0 md:pl-8">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Active NYC Club Members
              </p>
              <span className="font-mono text-xs text-neutral-500 tabular-nums">
                {filteredMembers.length} active
              </span>
            </div>
            <input
              type="text"
              value={directoryFilter}
              onChange={(e) => setDirectoryFilter(e.target.value)}
              placeholder="Search models, photographers, stylists..."
              className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black focus:outline-none mb-3"
            />
            <div className="divide-y divide-neutral-100 max-h-[300px] overflow-y-auto">
              {filteredMembers.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black truncate">{m.name}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{m.role}</p>
                  </div>
                  <span className="text-[11px] text-neutral-400 shrink-0">{m.location}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EditorialStoryModalProps {
  story: EditorialStory | null;
  onClose: () => void;
  onUnlockMembership: () => void;
}

export const EditorialStoryModal: React.FC<EditorialStoryModalProps> = ({
  story,
  onClose,
  onUnlockMembership,
}) => {
  if (!story) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
    >
      <div className="bg-white text-black border border-black w-full max-w-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            {story.kicker} {story.proOnly ? '· Pro Intelligence' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story"
            className="p-1 text-neutral-500 hover:text-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-[16/10] w-full bg-neutral-100 overflow-hidden">
          {story.imageSrc ? (
            <img
              src={story.imageSrc}
              alt={story.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[50%_20%]"
            />
          ) : (
            <EditorialPlate variant={story.variant} className="w-full h-full" label={story.title} />
          )}
        </div>
        <div className="p-6">
          <h4 className="font-display font-bold text-xl leading-snug">{story.title}</h4>
          <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">{story.byline}</p>
          <p className="mt-4 text-sm text-neutral-700 leading-relaxed">{story.summary}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {story.proOnly && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUnlockMembership();
                }}
                className="px-5 py-2.5 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
              >
                Unlock Full Brief with Membership
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-300 text-xs font-semibold hover:border-black transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LookbookLightboxProps {
  frame: SocialFrame | null;
  onClose: () => void;
}

export const LookbookLightbox: React.FC<LookbookLightboxProps> = ({ frame, onClose }) => {
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [frame?.id, frame?.imageSrc]);

  if (!frame) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={frame.title}
    >
      <div className="bg-white text-black border border-black w-full max-w-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">
            NYC Model Club Visual Archive
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lightbox"
            className="p-1 text-neutral-500 hover:text-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-[4/3] w-full bg-neutral-100 overflow-hidden">
          {frame.imageSrc && !imageError ? (
            <img
              src={frame.imageSrc}
              alt={frame.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <EditorialPlate variant={frame.plateVariant} className="w-full h-full" label={frame.title} />
          )}
        </div>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-display font-bold text-lg">{frame.title}</h4>
            <p className="text-xs text-neutral-600 mt-0.5">{frame.caption}</p>
          </div>
          <span className="font-mono text-[11px] text-neutral-500 shrink-0">{frame.credit}</span>
        </div>
      </div>
    </div>
  );
};

interface InfoModalProps {
  section: 'about' | 'contact' | null;
  onClose: () => void;
  onJumpToManagement: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  section,
  onClose,
  onJumpToManagement,
}) => {
  if (!section) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white text-black border border-black w-full max-w-lg p-7 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 text-neutral-500 hover:text-black"
        >
          <X className="w-5 h-5" />
        </button>

        {section === 'about' ? (
          <>
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Open to All Models · Platform &amp; Agency Overview
            </p>
            <h3 className="font-display font-bold text-2xl mt-2">
              NYC Model Club &amp; New York City Model Management
            </h3>
            <p className="mt-4 text-sm text-neutral-700 leading-relaxed">
              <strong>NYC Model Club</strong> — Open to All Models — connects emerging and
              established New York talent with verified casting teams, Manhattan access at Ripley
              Grier Studios, and production resources.
            </p>
            <p className="mt-3 text-sm text-neutral-700 leading-relaxed">
              <strong>New York City Model Management</strong> represents a curated roster of
              runway, editorial, commercial, and AI talent, handling direct client inquiries,
              production coordination, and private rate schedules through our booking desk.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onJumpToManagement();
                }}
                className="px-5 py-2.5 bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                View Agency Management
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-neutral-300 text-xs font-semibold hover:border-black transition-colors"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Concierge &amp; Booking Desk
            </p>
            <h3 className="font-display font-bold text-2xl mt-2">Contact &amp; Studio Line</h3>
            <div className="mt-4 space-y-4 text-sm text-neutral-700">
              <div>
                <span className="block text-xs text-neutral-500">Direct Inquiries</span>
                <a
                  href={`mailto:${CONTACT_CONFIG.directInquiriesEmail}`}
                  className="font-medium text-black underline underline-offset-4 hover:text-neutral-600"
                >
                  {CONTACT_CONFIG.directInquiriesEmail}
                </a>
              </div>
              <div>
                <span className="block text-xs text-neutral-500">{CONTACT_CONFIG.officeLabel}</span>
                <span className="font-medium text-black">{CONTACT_CONFIG.officeAddress}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full py-2.5 bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
};
