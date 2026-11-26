export type CreativeRoleId = 'model' | 'influencer' | 'photographer' | 'agency' | 'makeup';

export interface RoleOption {
  id: CreativeRoleId;
  label: string;
}

export type VisibilityScope = 'public' | 'verified_clients_only';

export interface DirectoryMember {
  id: string;
  name: string;
  role: string;
  location: string;
  initials: string;
  variant: PlateVariant;
  imageSrc?: string;
  category: 'model' | 'creative';
  isMinor?: boolean;
  visibility?: 'public' | 'clients_only';
  visibilityScope?: VisibilityScope;
}

export type MembershipPlanId = 'talent' | 'studio' | 'clients';

export interface MembershipTier {
  id: MembershipPlanId;
  indexLabel: string;
  name: string;
  kicker: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  description: string;
  features: string[];
  ctaLabel: string;
  defaultRole: string;
  highlighted?: boolean;
}

export type EliteDivision =
  | 'All Roster'
  | 'Runway'
  | 'Editorial'
  | 'Commercial'
  | 'AI Representation';

export interface BookingPackage {
  id: string;
  label: string;
  baseRateDollars: number;
  duration: string;
}

export interface EliteModel {
  id: string;
  name: string;
  division: Exclude<EliteDivision, 'All Roster'>;
  plateVariant: PlateVariant;
  imageSrc?: string;
  height: string;
  measurements: string;
  hair: string;
  eyes: string;
  shoe: string;
  location: string;
  clients: string[];
  bio: string;
  plateCode: string;
  dayRateDollars: number;
  aiTalent?: boolean;
  licensingTerms?: string;
  isMinor?: boolean;
  visibility?: 'public' | 'clients_only';
  visibilityScope?: VisibilityScope;
}

export function calculateExactAge(dateOfBirth: string): number | null {
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

export type MediaCategory =
  | 'All Services'
  | 'Photography / Images'
  | 'Film & Motion'
  | 'Visual Works'
  | 'Lookbook & Catalog';

export interface MediaProductionService {
  id: string;
  indexLabel: string;
  category: Exclude<MediaCategory, 'All Services'>;
  title: string;
  turnaround: string;
  rateDollars: number;
  summary: string;
  deliverables: string[];
  exampleNote?: string;
}

export interface ModelValuePillar {
  indexLabel: string;
  categoryTag: string;
  title: string;
  description: string;
}

export interface EditorialStory {
  id: string;
  kicker: string;
  title: string;
  byline: string;
  variant: PlateVariant;
  imageSrc?: string;
  proOnly?: boolean;
  summary: string;
}

export type WorkCategory =
  | 'All Latest'
  | 'Advertising Campaigns'
  | 'Covers'
  | 'Editorials'
  | 'Lookbooks'
  | 'Digitals';

export interface LatestWorkItem {
  id: string;
  brand: string;
  category: Exclude<WorkCategory, 'All Latest'>;
  subtitle: string;
  variant: PlateVariant;
  imageSrc?: string;
}

export interface SocialFrame {
  id: string;
  plateVariant: PlateVariant;
  imageSrc?: string;
  title: string;
  subtitle?: string;
  caption: string;
  credit: string;
}

export type PlateVariant =
  | 'hero_editorial'
  | 'soren'
  | 'nadia'
  | 'kaelen'
  | 'julian'
  | 'claire'
  | 'mateo'
  | 'beach'
  | 'cover_numero'
  | 'studio_group'
  | 'campaign_warm'
  | 'runway_red';

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'model', label: 'Model' },
  { id: 'photographer', label: 'Photographer' },
  { id: 'agency', label: 'Casting / Agency' },
  { id: 'makeup', label: 'Hair & Makeup' },
  { id: 'influencer', label: 'Stylist / Director' },
];

export const PRO_NEWS_STORIES: EditorialStory[] = [
  {
    id: 'pn1',
    kicker: 'Market Intelligence',
    title: 'How Direct Digital Submissions Are Reshaping NYC Fall Castings',
    byline: 'By Claire Ashworth',
    variant: 'campaign_warm',
    imageSrc: '/images/pro-news-1.png',
    proOnly: true,
    summary:
      'Casting directors across SoHo and Tribeca increasingly review unretouched member digitals before issuing formal go-see invitations.',
  },
  {
    id: 'pn2',
    kicker: 'Op-Ed',
    title: 'SoHo Showrooms & Independent Casting: Why Direct Booking Wins',
    byline: 'By Marcus Vance',
    variant: 'soren',
    imageSrc: '/images/pro-news-2.png',
    proOnly: true,
    summary:
      'Boutique labels and creative directors are replacing lengthy agency chains with instant digital comps and transparent day rates.',
  },
  {
    id: 'pn3',
    kicker: 'Runway Brief',
    title: 'NYFW Casting Schedules: What Independent Models Need Ready This Season',
    byline: 'By Elena Vance',
    variant: 'runway_red',
    imageSrc: '/images/pro-news-3.png',
    proOnly: true,
    summary:
      'A practical breakdown of walk tapes, composite specs, and call-sheet timing expected by downtown showrooms.',
  },
  {
    id: 'pn4',
    kicker: 'Industry Report',
    title: 'SoHo Production Timing: How Digital Call Sheets Streamline Fashion Bookings',
    byline: 'By Devon Brooks',
    variant: 'studio_group',
    imageSrc: '/images/pro-news-4.png',
    proOnly: true,
    summary:
      'From casting shortlist to confirmed shoot dates, digital production desks keep client teams and represented talent aligned on set.',
  },
];

export const TRENDING_CARDS: EditorialStory[] = [
  {
    id: 'tr1',
    kicker: 'Editorial',
    title: 'Ripley Grier Studios Daylight Series',
    byline: 'Manhattan · Ripley Grier Studios',
    variant: 'nadia',
    imageSrc: '/assets/trending_1.png',
    summary: 'Unretouched natural window portraits shot by Club photographers.',
  },
  {
    id: 'tr2',
    kicker: 'Campaign',
    title: 'Mercer Wool & Tailoring Fall',
    byline: 'Tribeca',
    variant: 'julian',
    imageSrc: '/assets/trending_2.png',
    summary: 'Menswear outerwear study cast directly from the NYC Model Club directory.',
  },
  {
    id: 'tr3',
    kicker: 'Cover Study',
    title: 'Mono Print Issue 12',
    byline: 'Chelsea',
    variant: 'cover_numero',
    imageSrc: '/assets/trending_3.png',
    summary: 'Medium-format studio portraiture exploring stark shadow geometry.',
  },
  {
    id: 'tr4',
    kicker: 'New Faces',
    title: 'Brooklyn Five-Borough Call',
    byline: 'Williamsburg',
    variant: 'kaelen',
    imageSrc: '/assets/trending_4.png',
    summary: 'Sixteen new faces photographed during our open weekend casting.',
  },
  {
    id: 'tr5',
    kicker: 'Lookbook',
    title: 'Rockaway Architectural Resort',
    byline: 'Queens',
    variant: 'beach',
    imageSrc: '/assets/trending_5.png',
    summary: 'Minimalist daylight silhouette study featuring Club members.',
  },
  {
    id: 'tr6',
    kicker: 'Beauty',
    title: 'Clean Skin & Studio Rim Light',
    byline: 'Lower East Side',
    variant: 'claire',
    imageSrc: '/assets/trending_6.png',
    summary: 'Close-up monochrome beauty frames by Club makeup artists.',
  },
];

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 'talent',
    indexLabel: '01',
    name: 'Model & Talent Membership',
    kicker: 'Roster & Portfolio',
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    description:
      'Open to All Models — for aspiring and established talent applying to join the roster, manage their portfolio presence, and get featured.',
    features: [
      'Apply directly to join the NYC Model Club roster',
      'Manage your verified portfolio, 4K digitals & comp-card specs',
      'Get featured across Editorial Spreads, Trending & Social plates',
      'Direct scouting visibility to New York City Model Management',
    ],
    ctaLabel: 'Apply as Talent',
    defaultRole: 'Model',
  },
  {
    id: 'studio',
    indexLabel: '02',
    name: 'Studio Access',
    kicker: 'Manhattan Studio + Roster',
    monthlyPrice: 59,
    annualMonthlyPrice: 47,
    description:
      'Complete Model & Talent Membership plus monthly Manhattan shoots at Ripley Grier Studios, comp-card printing, and direct portfolio reviews.',
    features: [
      'Everything included in Model & Talent Membership',
      'Monthly Ripley Grier Studios (Manhattan) digital & portrait shoot session',
      'Printed & digital composite cards prepared for NYC go-sees',
      'Quarterly private portfolio review by NYC Model Management',
    ],
    ctaLabel: 'Unlock Studio Access',
    defaultRole: 'Model',
    highlighted: true,
  },
  {
    id: 'clients',
    indexLabel: '03',
    name: 'Clients & Agencies Access',
    kicker: 'Brands & Casting Desks',
    monthlyPrice: 99,
    annualMonthlyPrice: 79,
    description:
      'For brands, casting directors, and partner agencies unlocking full portfolios, private rate desks, and preferred client member booking discounts.',
    features: [
      'Preferred 15% client member discount on talent & media bookings',
      'Unlock private agency & Media & Visual Works rate schedules',
      'Review full verified model portfolios & unretouched digitals',
      'Downloadable comp-card PDFs & priority casting inquiries',
    ],
    ctaLabel: 'Unlock Client & Agency Access',
    defaultRole: 'Casting / Agency',
  },
];

export const BOOKING_PACKAGES: BookingPackage[] = [
  {
    id: 'half_day',
    label: 'Half-Day Editorial / Test',
    baseRateDollars: 1500,
    duration: '4 Hours · NYC Metro',
  },
  {
    id: 'full_day',
    label: 'Full-Day Editorial / Lookbook',
    baseRateDollars: 2500,
    duration: '8 Hours · NYC Metro',
  },
  {
    id: 'campaign',
    label: 'Commercial Campaign Buyout',
    baseRateDollars: 5000,
    duration: '1 Day + Print/Digital',
  },
  {
    id: 'runway',
    label: 'NYFW / Runway Show Package',
    baseRateDollars: 8000,
    duration: 'Fittings + Show Exclusivity',
  },
];

export const ELITE_ROSTER: EliteModel[] = [
  {
    id: 'el-soren',
    name: 'Soren Lindqvist',
    division: 'Runway',
    plateVariant: 'soren',
    imageSrc: '/images/soren-lindqvist.png',
    height: '6\'2"',
    measurements: '38 · 29 · 36',
    hair: 'Dark Blonde',
    eyes: 'Steel Blue',
    shoe: '11 US',
    location: 'Manhattan / Paris',
    clients: ['Saint Laurent', 'COS', 'Dazed'],
    bio: 'Hand-selected from the NYC Model Club open directory, Soren anchors New York City Model Management’s menswear runway division.',
    plateCode: 'NYCMM-01',
    dayRateDollars: 2500,
  },
  {
    id: 'el-nadia',
    name: 'Nadia Moreau',
    division: 'Editorial',
    plateVariant: 'nadia',
    imageSrc: '/images/nadia-moreau.png',
    height: '5\'10.5"',
    measurements: '32 · 23.5 · 34',
    hair: 'Espresso',
    eyes: 'Dark Brown',
    shoe: '8.5 US',
    location: 'Brooklyn / Milan',
    clients: ['Vogue Italia', 'The Row', 'Toteme'],
    bio: 'Exclusively represented by New York City Model Management for international print editorials, luxury lookbooks, and showroom exclusives.',
    plateCode: 'NYCMM-02',
    dayRateDollars: 2500,
  },
  {
    id: 'el-kaelen',
    name: 'Kaelen Vance',
    division: 'Runway',
    plateVariant: 'kaelen',
    imageSrc: '/images/kaelen-vance.png',
    height: '5\'11.5"',
    measurements: '31 · 23 · 34.5',
    hair: 'Black',
    eyes: 'Amber Brown',
    shoe: '9 US',
    location: 'Harlem / London',
    clients: ['Proenza Schouler', 'Khaite', 'i-D'],
    bio: 'Scouted through NYC Model Club Studio Atelier, Kaelen walked nine NYFW shows in her debut season under NYC Model Management.',
    plateCode: 'NYCMM-03',
    dayRateDollars: 2500,
  },
  {
    id: 'el-julian',
    name: 'Julian Mercer',
    division: 'Commercial',
    plateVariant: 'julian',
    imageSrc: '/images/julian-mercer.png',
    height: '6\'1"',
    measurements: '39 · 30 · 37',
    hair: 'Chestnut',
    eyes: 'Hazel',
    shoe: '10.5 US',
    location: 'Tribeca / Los Angeles',
    clients: ['Calvin Klein', 'Theory', 'GQ'],
    bio: 'Signed exclusively to New York City Model Management for global menswear campaigns, fragrance launches, and e-commerce.',
    plateCode: 'NYCMM-04',
    dayRateDollars: 2500,
  },
  {
    id: 'el-claire',
    name: 'Claire Solis',
    division: 'Editorial',
    plateVariant: 'claire',
    imageSrc: '/images/claire-solis.png',
    height: '5\'9.5"',
    measurements: '32 · 24 · 34',
    hair: 'Raven',
    eyes: 'Green',
    shoe: '8 US',
    location: 'SoHo / Tokyo',
    clients: ['Jil Sander', 'WSJ Magazine', 'Aesop'],
    bio: 'Represented for beauty close-ups and luxury skin campaigns, available for direct online booking through our agency desk.',
    plateCode: 'NYCMM-05',
    dayRateDollars: 2500,
  },
  {
    id: 'el-mateo',
    name: 'Mila Alvarez',
    division: 'Commercial',
    plateVariant: 'mateo',
    imageSrc: '/images/mila-alvarez.png',
    height: '5\'10"',
    measurements: '32 · 23.5 · 34',
    hair: 'Dark Brown',
    eyes: 'Hazel',
    shoe: '8.5 US',
    location: 'Chelsea / Milan',
    clients: ['Armani', 'Toteme', 'Esquire'],
    bio: 'Direct-booking commercial talent managed by New York City Model Management for tailoring, campaign, and lookbook productions.',
    plateCode: 'NYCMM-06',
    dayRateDollars: 2500,
  },
  {
    id: 'el-nyra-ai',
    name: 'Nyra Vox',
    division: 'AI Representation',
    plateVariant: 'claire',
    imageSrc: '/images/nyra-vox.png',
    height: '5\'11"',
    measurements: '32 · 23 · 34',
    hair: 'Obsidian',
    eyes: 'Graphite',
    shoe: '9 US',
    location: 'SoHo Digital Lab · Global',
    clients: ['Dazed Digital', 'SSENSE Concept', 'Runway Archive'],
    bio: 'Pioneering AI Model Representation talent licensed through NYC Model Club, delivering consistent 4K editorial likenesses, digital campaign lookbooks, and rapid multi-market visual adaptations.',
    plateCode: 'NYCMM-AI01',
    dayRateDollars: 2500,
    aiTalent: true,
    licensingTerms: 'Licensed AI Likeness · 4K Print, E-Commerce & Campaign Rights',
  },
  {
    id: 'el-kael-ai',
    name: 'Kael Zero',
    division: 'AI Representation',
    plateVariant: 'soren',
    imageSrc: '/images/kael-zero.png',
    height: '6\'1.5"',
    measurements: '38 · 29 · 36',
    hair: 'Ash Slate',
    eyes: 'Ice',
    shoe: '10.5 US',
    location: 'Tribeca Studio · Global',
    clients: ['Acne Digital', 'Vogue Business', 'Techwear Lab'],
    bio: 'Represented in NYC Model Club’s AI Talent Division, one of the first New York agencies to represent AI talent and offer licensed digital models for global lookbooks and motion campaigns.',
    plateCode: 'NYCMM-AI02',
    dayRateDollars: 2500,
    aiTalent: true,
    licensingTerms: 'Licensed AI Likeness · Menswear Catalog, Motion & Global Usage',
  },
];

export const MODEL_VALUE_PILLARS: ModelValuePillar[] = [
  {
    indexLabel: '01',
    categoryTag: 'Portfolio & Control',
    title: 'Own Your Career',
    description:
      'Keep your book fresh, set your own rates, and book directly with checked clients and sets.',
  },
  {
    indexLabel: '02',
    categoryTag: 'NYC Opportunities',
    title: 'Get Seen in NYC',
    description:
      'Jump into fresh New York shoots, runway castings, and editorial sets happening every week.',
  },
  {
    indexLabel: '03',
    categoryTag: 'Booking Safety',
    title: 'Safe Sets, Clear Pay',
    description:
      'Vetted shoots, clear pay terms, and direct support from our team before and after you book.',
  },
];

export const CONTACT_CONFIG = {
  directInquiriesEmail:
    ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_CONTACT_EMAIL?.trim() || 'txmodelmanagement@gmail.com'),
  officeLabel: 'NYC Office',
  officeAddress: '99 Wall Street, Suite 1628, New York, NY 10005',
} as const;

export const MEDIA_PRODUCTION_SERVICES: MediaProductionService[] = [
  {
    id: 'mp-photo',
    indexLabel: '01',
    category: 'Photography / Images',
    title: 'Editorial & Brand Stills',
    turnaround: '1 Shoot Day · 48h Selects',
    rateDollars: 2400,
    summary:
      'Fast-moving studio and on-location shoots in NYC for fashion labels, new drops, and campaigns.',
    deliverables: [
      'Deliverables: 40 retouched high-res photos for up to 8 looks or 15 products',
      'Setup: Ripley Grier Studios (Manhattan) or NYC location with photographer & lighting',
      'Formats & Revisions: Masters + 4:5 feed & 9:16 story crops, 2 revision rounds',
    ],
  },
  {
    id: 'mp-film',
    indexLabel: '02',
    category: 'Film & Motion',
    title: 'Motion, Runway & Campaign Cuts',
    turnaround: '1 Shoot Day + Edit · 5 Days',
    rateDollars: 3800,
    summary:
      'Editorial fashion films, runway coverage, and fast-paced social teasers shot for new drops.',
    deliverables: [
      'Deliverables: 1 hero film (up to 60s) + 3 vertical cutdowns for up to 6 looks',
      'Setup: 4K cinema camera unit, stabilized rig, lighting & on-set direction',
      'Formats & Revisions: 16:9 master + 4:5 & 9:16 social crops, 2 edit & color rounds',
    ],
  },
  {
    id: 'mp-visual',
    indexLabel: '03',
    category: 'Visual Works',
    title: 'Creative Direction & Visual Sets',
    turnaround: '3 to 5 Business Days',
    rateDollars: 1800,
    summary:
      'Full shoot concepts, custom lighting and set design, retouching, and blended digital backdrops.',
    deliverables: [
      'Deliverables: Up to 20 composited visual plates for 10 looks or hero products',
      'Setup: Pre-shoot moodboard, lighting design & live or digital model pairing',
      'Formats & Revisions: Print/web masters + 4:5 & 9:16 crops, 2 revision rounds',
    ],
  },
  {
    id: 'mp-catalog',
    indexLabel: '04',
    category: 'Lookbook & Catalog',
    title: 'Collection Lookbook & 5-Page Catalog',
    turnaround: '7 Business Days',
    rateDollars: 4500,
    summary:
      'From rack styling to final layout, we shoot and sequence a 5-page catalog built for buyers and drops.',
    deliverables: [
      'Deliverables: 5-page catalog layout + 55 graded photos for 12 to 18 looks',
      'Setup: Full Manhattan studio crew at Ripley Grier Studios, art direction, steaming desk & model pairing',
      'Formats & Revisions: Print-ready PDF + web & social crops, 2 revision rounds',
    ],
  },
];

export const DIRECTORY_MEMBERS: DirectoryMember[] = [
  {
    id: 'dm1',
    name: 'Maya Lin',
    role: 'Model · SoHo, NY',
    location: 'Manhattan',
    initials: 'ML',
    variant: 'nadia',
    imageSrc: '/images/directory-maya.png',
    category: 'model',
  },
  {
    id: 'dm2',
    name: 'Lucas Delacroix',
    role: 'Model · Chelsea, NY',
    location: 'Manhattan',
    initials: 'LD',
    variant: 'soren',
    imageSrc: '/images/directory-lucas.png',
    category: 'model',
  },
  {
    id: 'dm3',
    name: 'Amara Osei',
    role: 'Model · Williamsburg, NY',
    location: 'Brooklyn',
    initials: 'AO',
    variant: 'kaelen',
    imageSrc: '/images/directory-amara.png',
    category: 'model',
  },
  {
    id: 'dm4',
    name: 'Hana Sato',
    role: 'Model · Lower East Side, NY',
    location: 'Manhattan',
    initials: 'HS',
    variant: 'claire',
    imageSrc: '/images/directory-hana.png',
    category: 'model',
  },
  {
    id: 'dm5',
    name: 'Devon Brooks',
    role: 'Photographer · Brooklyn, NY',
    location: 'Brooklyn',
    initials: 'DB',
    variant: 'julian',
    imageSrc: '/images/directory-devon.png',
    category: 'creative',
  },
  {
    id: 'dm6',
    name: 'Sora Takahashi',
    role: 'Makeup Artist · LES, NY',
    location: 'Manhattan',
    initials: 'ST',
    variant: 'beach',
    imageSrc: '/images/directory-sora.png',
    category: 'creative',
  },
  {
    id: 'dm7',
    name: 'Elena Rostova',
    role: 'Creative Director · Tribeca, NY',
    location: 'Manhattan',
    initials: 'ER',
    variant: 'campaign_warm',
    imageSrc: '/images/directory-elena.png',
    category: 'creative',
  },
  {
    id: 'dm8',
    name: 'Marcus Vance',
    role: 'Casting Producer · SoHo, NY',
    location: 'Manhattan',
    initials: 'MV',
    variant: 'mateo',
    imageSrc: '/images/directory-marcus.png',
    category: 'creative',
  },
];

export const LATEST_WORK: LatestWorkItem[] = [
  {
    id: 'lw1',
    brand: 'The Row Studio Test',
    category: 'Lookbooks',
    subtitle: 'Minimalist Wool Fall 2026',
    variant: 'beach',
    imageSrc: '/assets/aistudio/image_879a7648.png',
  },
  {
    id: 'lw2',
    brand: 'Mercer Tailoring',
    category: 'Advertising Campaigns',
    subtitle: 'SoHo Cast-Iron Campaign',
    variant: 'julian',
    imageSrc: '/assets/aistudio/image_4a2ebdcf.png',
  },
  {
    id: 'lw3',
    brand: 'Mono Journal Issue 12',
    category: 'Covers',
    subtitle: 'Autumn Legends Cover Story',
    variant: 'cover_numero',
    imageSrc: '/assets/aistudio/image_50f53772.png',
  },
  {
    id: 'lw4',
    brand: 'Ripley Grier Studios Digitals',
    category: 'Digitals',
    subtitle: '35mm Unretouched Polaroids',
    variant: 'nadia',
    imageSrc: '/assets/aistudio/image_cdcd254a.png',
  },
  {
    id: 'lw5',
    brand: 'Chelsea Beauty Study',
    category: 'Editorials',
    subtitle: 'Monochrome Portrait Plate',
    variant: 'claire',
    imageSrc: '/assets/aistudio/image_e23b6c5e.png',
  },
];

export const SOCIAL_FRAMES: SocialFrame[] = [
  {
    id: 'sf1',
    plateVariant: 'soren',
    imageSrc: '/assets/social_1.png',
    title: 'Newcomers S/S 27: Soren Lindqvist',
    subtitle: 'New Faces · Brooklyn',
    caption: 'Natural north-facing loft light, unretouched 35mm Tri-X test.',
    credit: 'NYC Model Club · Ripley Grier Studios, Manhattan',
  },
  {
    id: 'sf2',
    plateVariant: 'julian',
    imageSrc: '/assets/social_2.png',
    title: 'Tailoring in Cast-Iron Manhattan',
    subtitle: 'Campaign · Tribeca',
    caption: 'Street editorial pairing Club photographers with signed talent.',
    credit: 'NYC Model Club · Open to All Models',
  },
  {
    id: 'sf3',
    plateVariant: 'beach',
    imageSrc: '/assets/social_3.png',
    title: 'Architectural Daylight Capsule',
    subtitle: 'Lookbook · Queens',
    caption: 'High-contrast monochrome lookbook produced by Club members.',
    credit: 'Rockaway Beach · Campaign',
  },
  {
    id: 'sf4',
    plateVariant: 'nadia',
    imageSrc: '/assets/social_4.png',
    title: 'Studio Plate IV: Nadia Moreau',
    subtitle: 'Beauty · Lower East Side',
    caption: 'Clean beauty and bone-structure study for NYFW show packages.',
    credit: 'New York City Model Management',
  },
];
