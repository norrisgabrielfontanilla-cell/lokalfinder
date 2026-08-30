export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'For Customers', href: '#customers' },
  { label: 'For Businesses', href: '#businesses' },
  { label: 'Vision', href: '#vision' },
  { label: 'About', href: '#about' },
];

export type CategoryKey = 'food' | 'coffee' | 'laundry' | 'services' | 'sellers';

export const HERO_CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'food', label: 'Restaurants' },
  { key: 'coffee', label: 'Coffee shops' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'services', label: 'Services' },
  { key: 'sellers', label: 'Local sellers' },
];

export const CUSTOMER_JOURNEY = [
  {
    step: '01',
    title: 'Discover',
    description: 'Find the restaurants, shops, and services already inside your community.',
  },
  {
    step: '02',
    title: 'Choose',
    description: 'Browse real menus and products from sellers a few buildings away.',
  },
  {
    step: '03',
    title: 'Order',
    description: 'Place an order in seconds, no account juggling or app-switching.',
  },
  {
    step: '04',
    title: 'Receive',
    description: 'Get it delivered within your community — short distance, fast turnaround.',
  },
];

export const MERCHANT_STEPS = [
  { title: 'Create a storefront', description: 'Set up your business profile in minutes.' },
  { title: 'Upload products', description: 'List what you sell — food, services, or goods.' },
  { title: 'Receive orders', description: 'Orders land directly from neighbors nearby.' },
  { title: 'Manage customers', description: 'See who’s ordering and keep them coming back.' },
  { title: 'Deliver locally', description: 'Short, simple, community-scale delivery.' },
  { title: 'Grow within the community', description: 'Build a following where you already are.' },
];

export type EcosystemStage = {
  key: string;
  label: string;
};

export const ECOSYSTEM_STAGES: EcosystemStage[] = [
  { key: 'food', label: 'Food' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'services', label: 'Services' },
  { key: 'retail', label: 'Local retail' },
];

export const SOCIAL_PROOF_STATS = [
  { label: 'Communities onboarded', value: 'Early access' },
  { label: 'Local businesses', value: 'Growing weekly' },
  { label: 'Orders delivered', value: 'Just getting started' },
];

export const FOOTER_LINKS = {
  Product: [
    { label: 'How it works', href: '#customers' },
    { label: 'For businesses', href: '#businesses' },
    { label: 'Vision', href: '#vision' },
  ],
  Company: [
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#early-access' },
  ],
};
