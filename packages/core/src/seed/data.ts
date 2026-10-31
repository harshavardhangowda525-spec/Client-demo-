// Demonstration content. Every service, price, location, schedule and FAQ here
// is SAMPLE data for the Infinity Web & Apps client demo. None of it describes
// the client's real offering, prices, addresses or equipment.

import type { Brand } from '@studio/db';

const rupees = (n: number) => n * 100;

export interface SeedService {
  key: string;
  brand: Brand;
  category: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  bookingMode: 'DIRECT' | 'REQUEST' | 'ENQUIRY';
  pricingModel: 'FIXED' | 'HOURLY' | 'QUOTE';
  basePriceMinor?: number;
  hourlyRateMinor?: number;
  minDurationMin: number;
  maxDurationMin: number;
  durationStepMin: number;
  defaultDurationMin: number;
  bufferMin: number;
  requiresResource: boolean;
  imageKey: string;
  locations: string[];
  resources: string[];
  addOns: string[];
  packages?: { slug: string; name: string; description: string; includes: string[]; priceMinor: number; durationMin: number; isFeatured?: boolean }[];
}

export const categories: { brand: Brand; slug: string; name: string; description: string }[] = [
  { brand: 'PHOTO', slug: 'photography', name: 'Photography', description: 'Portrait, product, commercial and event photography.' },
  { brand: 'PHOTO', slug: 'videography', name: 'Videography', description: 'Promotional films and corporate video production.' },
  { brand: 'PODCAST', slug: 'recording', name: 'Recording', description: 'Audio and video podcast recording sessions.' },
  { brand: 'PODCAST', slug: 'rental', name: 'Studio rental', description: 'Self-operated studio hire.' },
  { brand: 'PODCAST', slug: 'production', name: 'Production', description: 'Custom podcast production packages.' },
  { brand: 'EVENTS', slug: 'corporate', name: 'Corporate events', description: 'Conferences, offsites and company celebrations.' },
  { brand: 'EVENTS', slug: 'celebrations', name: 'Celebrations', description: 'Birthdays, anniversaries and milestone gatherings.' },
  { brand: 'EVENTS', slug: 'workshops', name: 'Workshops', description: 'Hands-on sessions and learning events.' },
  { brand: 'EVENTS', slug: 'launches', name: 'Product launches', description: 'Reveals, press events and brand moments.' },
  { brand: 'EVENTS', slug: 'private', name: 'Private events', description: 'Intimate dinners and invitation-only occasions.' },
  { brand: 'EVENTS', slug: 'planning', name: 'Planning services', description: 'Consultations you can book directly.' },
];

export const addOns: { brand: Brand; slug: string; name: string; description: string; pricing: 'FIXED' | 'PER_HOUR'; priceMinor: number }[] = [
  { brand: 'PHOTO', slug: 'extra-retouching', name: 'Extended retouching (10 images)', description: 'Additional high-end retouching.', pricing: 'FIXED', priceMinor: rupees(3500) },
  { brand: 'PHOTO', slug: 'hair-makeup', name: 'Hair and make-up artist', description: 'Artist on set for the session.', pricing: 'PER_HOUR', priceMinor: rupees(1500) },
  { brand: 'PHOTO', slug: 'express-delivery', name: 'Express delivery (48 hours)', description: 'Priority editing queue.', pricing: 'FIXED', priceMinor: rupees(2500) },
  { brand: 'PHOTO', slug: 'drone-footage', name: 'Aerial footage', description: 'Subject to location permissions.', pricing: 'FIXED', priceMinor: rupees(8000) },
  { brand: 'PODCAST', slug: 'audio-editing', name: 'Audio editing', description: 'Edit, clean-up and loudness normalisation.', pricing: 'PER_HOUR', priceMinor: rupees(1200) },
  { brand: 'PODCAST', slug: 'video-editing', name: 'Video editing (one episode)', description: 'Multi-camera edit of one episode.', pricing: 'FIXED', priceMinor: rupees(6000) },
  { brand: 'PODCAST', slug: 'social-clips', name: 'Short social clips (×3)', description: 'Three vertical highlight clips.', pricing: 'FIXED', priceMinor: rupees(3000) },
  { brand: 'PODCAST', slug: 'engineer', name: 'Session engineer', description: 'Engineer operating the desk during rental.', pricing: 'PER_HOUR', priceMinor: rupees(900) },
  { brand: 'EVENTS', slug: 'moodboard', name: 'Concept moodboard', description: 'Visual concept prepared after the consultation.', pricing: 'FIXED', priceMinor: rupees(3000) },
];

export const locations = [
  {
    key: 'blr-studio',
    slug: 'bengaluru-studio-demo',
    name: 'Bengaluru Studio (demo location)',
    brands: ['PHOTO', 'PODCAST'] as Brand[],
    addressLine1: 'Address to be confirmed by the client',
    city: 'Bengaluru',
    region: 'Karnataka',
    description: 'Demonstration location. The real address, facilities and directions will be added once supplied by the client.',
    imageKey: 'photo-commercial',
  },
  {
    key: 'bom-studio',
    slug: 'mumbai-studio-demo',
    name: 'Mumbai Studio (demo location)',
    brands: ['PODCAST'] as Brand[],
    addressLine1: 'Address to be confirmed by the client',
    city: 'Mumbai',
    region: 'Maharashtra',
    description: 'Demonstration location for multi-studio availability.',
    imageKey: 'podcast-multicam',
  },
  {
    key: 'events-lounge',
    slug: 'planning-lounge-demo',
    name: 'Planning Lounge (demo location)',
    brands: ['EVENTS'] as Brand[],
    addressLine1: 'Address to be confirmed by the client',
    city: 'Bengaluru',
    region: 'Karnataka',
    description: 'Demonstration meeting space for event consultations.',
    imageKey: 'events-detail',
  },
  {
    key: 'garden-venue',
    slug: 'garden-venue-demo',
    name: 'Garden Venue (demo venue)',
    brands: ['EVENTS'] as Brand[],
    addressLine1: 'Venue details to be confirmed',
    city: 'Bengaluru',
    region: 'Karnataka',
    description: 'Sample outdoor venue used to demonstrate venue scheduling.',
    imageKey: 'events-celebration',
  },
  {
    key: 'ballroom-venue',
    slug: 'ballroom-venue-demo',
    name: 'Ballroom (demo venue)',
    brands: ['EVENTS'] as Brand[],
    addressLine1: 'Venue details to be confirmed',
    city: 'Mumbai',
    region: 'Maharashtra',
    description: 'Sample indoor venue used to demonstrate venue scheduling.',
    imageKey: 'events-hero',
  },
];

export const resources = [
  { key: 'cyc-a', location: 'blr-studio', name: 'Cyclorama Studio A', type: 'STUDIO' as const, description: 'Sample studio resource.', capacity: 12 },
  { key: 'daylight-b', location: 'blr-studio', name: 'Daylight Studio B', type: 'STUDIO' as const, description: 'Sample studio resource.', capacity: 8 },
  { key: 'crew-1', location: 'blr-studio', name: 'Production crew 1', type: 'CREW' as const, description: 'Sample crew allocation for on-location work.' },
  { key: 'crew-2', location: 'blr-studio', name: 'Production crew 2', type: 'CREW' as const, description: 'Sample crew allocation for on-location work.' },
  { key: 'pod-room-1', location: 'blr-studio', name: 'Podcast Room 1', type: 'ROOM' as const, description: 'Sample two-person audio room.', capacity: 2 },
  { key: 'pod-video-set', location: 'blr-studio', name: 'Video Podcast Set', type: 'STUDIO' as const, description: 'Sample video set.', capacity: 4 },
  { key: 'pod-room-a', location: 'bom-studio', name: 'Podcast Room A', type: 'ROOM' as const, description: 'Sample audio room.', capacity: 3 },
  { key: 'pod-multicam', location: 'bom-studio', name: 'Multi-camera Set', type: 'STUDIO' as const, description: 'Sample multi-camera set.', capacity: 4 },
  { key: 'lounge', location: 'events-lounge', name: 'Consultation table', type: 'ROOM' as const, description: 'Sample meeting space.', capacity: 6 },
  { key: 'garden', location: 'garden-venue', name: 'Garden lawn', type: 'VENUE' as const, description: 'Sample venue space.', capacity: 250 },
  { key: 'ballroom', location: 'ballroom-venue', name: 'Ballroom hall', type: 'VENUE' as const, description: 'Sample venue space.', capacity: 400 },
];

const STUDIO_HOURS = [
  ...[1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, open: 9 * 60, close: 21 * 60 })),
  { dayOfWeek: 0, open: 10 * 60, close: 18 * 60 },
];
export const openingHours: Record<string, { dayOfWeek: number; open: number; close: number }[]> = {
  'blr-studio': STUDIO_HOURS,
  'bom-studio': STUDIO_HOURS,
  'events-lounge': [
    ...[1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, open: 10 * 60, close: 18 * 60 })),
    { dayOfWeek: 6, open: 10 * 60, close: 14 * 60 },
  ],
  'garden-venue': [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, open: 8 * 60, close: 24 * 60 })),
  'ballroom-venue': [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, open: 8 * 60, close: 24 * 60 })),
};

export const services: SeedService[] = [
  // --- Photography & videography -------------------------------------------------
  {
    key: 'portrait', brand: 'PHOTO', category: 'photography', slug: 'portrait-photography', name: 'Portrait photography',
    summary: 'Studio portraits for individuals, founders and creative profiles.',
    description: 'A guided studio session with lighting designed around you. Includes a pre-shoot call, styling guidance and a curated, retouched selection. Package contents are sample values for demonstration.',
    bookingMode: 'DIRECT', pricingModel: 'FIXED', basePriceMinor: rupees(6000), minDurationMin: 60, maxDurationMin: 180, durationStepMin: 30, defaultDurationMin: 90, bufferMin: 30,
    requiresResource: true, imageKey: 'photo-portrait', locations: ['blr-studio'], resources: ['cyc-a', 'daylight-b'], addOns: ['extra-retouching', 'hair-makeup', 'express-delivery'],
    packages: [
      { slug: 'essential', name: 'Essential', description: 'A focused session for a refreshed profile.', includes: ['60-minute session', '1 look', '8 retouched images'], priceMinor: rupees(6000), durationMin: 60 },
      { slug: 'signature', name: 'Signature', description: 'Room to explore multiple looks and set-ups.', includes: ['120-minute session', 'Up to 3 looks', '20 retouched images'], priceMinor: rupees(12500), durationMin: 120, isFeatured: true },
    ],
  },
  {
    key: 'product', brand: 'PHOTO', category: 'photography', slug: 'product-photography', name: 'Product photography',
    summary: 'Clean, consistent product imagery for catalogues and campaigns.',
    description: 'Hourly studio time with a photographer and assistant for e-commerce and campaign product work. Billed by the hour in 30-minute increments.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(4500), minDurationMin: 60, maxDurationMin: 480, durationStepMin: 30, defaultDurationMin: 120, bufferMin: 30,
    requiresResource: true, imageKey: 'photo-product', locations: ['blr-studio'], resources: ['cyc-a', 'daylight-b'], addOns: ['extra-retouching', 'express-delivery'],
  },
  {
    key: 'commercial', brand: 'PHOTO', category: 'photography', slug: 'commercial-shoots', name: 'Commercial shoots',
    summary: 'Art-directed campaign shoots with a full production crew.',
    description: 'Full-day or half-day commercial productions. Requests are reviewed by the team to confirm crew, styling and scope before payment.',
    bookingMode: 'REQUEST', pricingModel: 'FIXED', basePriceMinor: rupees(40000), minDurationMin: 240, maxDurationMin: 600, durationStepMin: 60, defaultDurationMin: 480, bufferMin: 60,
    requiresResource: true, imageKey: 'photo-commercial', locations: ['blr-studio'], resources: ['cyc-a'], addOns: ['hair-makeup', 'drone-footage'],
    packages: [
      { slug: 'half-day', name: 'Half day', description: 'Four hours of production time.', includes: ['4-hour production', 'Photographer + assistant', '25 final images'], priceMinor: rupees(28000), durationMin: 240 },
      { slug: 'full-day', name: 'Full day', description: 'Eight hours of production time.', includes: ['8-hour production', 'Full crew', '60 final images'], priceMinor: rupees(48000), durationMin: 480, isFeatured: true },
    ],
  },
  {
    key: 'event-photo', brand: 'PHOTO', category: 'photography', slug: 'event-photography', name: 'Event photography',
    summary: 'Discreet, story-led coverage of your event.',
    description: 'A photographer from our crew covers your event. Hourly booking; the crew allocation is checked so the same team is never double-booked.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(5000), minDurationMin: 120, maxDurationMin: 600, durationStepMin: 60, defaultDurationMin: 180, bufferMin: 60,
    requiresResource: true, imageKey: 'photo-event', locations: ['blr-studio'], resources: ['crew-1', 'crew-2'], addOns: ['express-delivery', 'drone-footage'],
  },
  {
    key: 'promo-video', brand: 'PHOTO', category: 'videography', slug: 'promotional-videos', name: 'Promotional videos',
    summary: 'Short-form films for launches, social media and campaigns.',
    description: 'Concept, shoot and edit for a short promotional film. Package values are demonstration figures.',
    bookingMode: 'DIRECT', pricingModel: 'FIXED', basePriceMinor: rupees(45000), minDurationMin: 240, maxDurationMin: 480, durationStepMin: 60, defaultDurationMin: 240, bufferMin: 60,
    requiresResource: true, imageKey: 'video-promo', locations: ['blr-studio'], resources: ['crew-1', 'crew-2'], addOns: ['drone-footage', 'express-delivery'],
    packages: [
      { slug: 'social-cut', name: 'Social cut', description: 'One 30–45 second film with vertical and horizontal versions.', includes: ['Half-day shoot', '1 film, 2 aspect ratios', '2 revision rounds'], priceMinor: rupees(45000), durationMin: 240, isFeatured: true },
    ],
  },
  {
    key: 'corporate-video', brand: 'PHOTO', category: 'videography', slug: 'corporate-video', name: 'Corporate video production',
    summary: 'Interviews, explainers and internal communications.',
    description: 'Multi-camera interview and explainer production. Submitted as a request so the team can confirm scope and crew.',
    bookingMode: 'REQUEST', pricingModel: 'FIXED', basePriceMinor: rupees(60000), minDurationMin: 240, maxDurationMin: 600, durationStepMin: 60, defaultDurationMin: 480, bufferMin: 60,
    requiresResource: true, imageKey: 'video-corporate', locations: ['blr-studio'], resources: ['crew-1', 'crew-2'], addOns: ['express-delivery'],
  },
  // --- Podcast ---------------------------------------------------------------------
  {
    key: 'audio-recording', brand: 'PODCAST', category: 'recording', slug: 'audio-recording', name: 'Audio recording',
    summary: 'Engineered audio sessions for interviews and conversations.',
    description: 'A treated room with an engineer monitoring levels. Equipment details will be listed once verified by the client.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(2500), minDurationMin: 60, maxDurationMin: 360, durationStepMin: 30, defaultDurationMin: 120, bufferMin: 15,
    requiresResource: true, imageKey: 'podcast-mic', locations: ['blr-studio', 'bom-studio'], resources: ['pod-room-1', 'pod-room-a'], addOns: ['audio-editing', 'social-clips'],
  },
  {
    key: 'video-podcast', brand: 'PODCAST', category: 'recording', slug: 'video-podcast-recording', name: 'Video podcast recording',
    summary: 'Audio and video captured together for every platform.',
    description: 'A lit video set with recorded camera angles alongside your audio. Specifications are placeholders until confirmed.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(4000), minDurationMin: 60, maxDurationMin: 360, durationStepMin: 30, defaultDurationMin: 120, bufferMin: 30,
    requiresResource: true, imageKey: 'podcast-video', locations: ['blr-studio', 'bom-studio'], resources: ['pod-video-set', 'pod-multicam'], addOns: ['audio-editing', 'video-editing', 'social-clips'],
  },
  {
    key: 'multicam', brand: 'PODCAST', category: 'recording', slug: 'multi-camera-sessions', name: 'Multi-camera sessions',
    summary: 'Directed multi-camera recordings for flagship shows.',
    description: 'A multi-camera session with a director for shows that need broadcast-style coverage.',
    bookingMode: 'DIRECT', pricingModel: 'FIXED', basePriceMinor: rupees(12000), minDurationMin: 120, maxDurationMin: 240, durationStepMin: 60, defaultDurationMin: 120, bufferMin: 30,
    requiresResource: true, imageKey: 'podcast-multicam', locations: ['bom-studio'], resources: ['pod-multicam'], addOns: ['video-editing', 'social-clips'],
    packages: [
      { slug: 'episode', name: 'Single episode', description: 'Record one episode with multi-camera coverage.', includes: ['2-hour session', 'Director on set', 'Raw camera files'], priceMinor: rupees(12000), durationMin: 120 },
      { slug: 'double-header', name: 'Double header', description: 'Record two episodes back to back.', includes: ['4-hour session', 'Director on set', 'Raw camera files'], priceMinor: rupees(21000), durationMin: 240, isFeatured: true },
    ],
  },
  {
    key: 'studio-rental', brand: 'PODCAST', category: 'rental', slug: 'studio-rental', name: 'Studio rental',
    summary: 'Self-operated studio time for experienced creators.',
    description: 'Book the room by the hour and run your own session. Add a session engineer if you need one.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(1800), minDurationMin: 60, maxDurationMin: 480, durationStepMin: 60, defaultDurationMin: 120, bufferMin: 15,
    requiresResource: true, imageKey: 'podcast-booth', locations: ['blr-studio', 'bom-studio'], resources: ['pod-room-1', 'pod-room-a'], addOns: ['engineer'],
  },
  {
    key: 'custom-production', brand: 'PODCAST', category: 'production', slug: 'custom-production', name: 'Custom production packages',
    summary: 'Recording, editing and publishing support for a full season.',
    description: 'Request a production slot; the team reviews your format and confirms the plan before payment is requested.',
    bookingMode: 'REQUEST', pricingModel: 'FIXED', basePriceMinor: rupees(30000), minDurationMin: 180, maxDurationMin: 360, durationStepMin: 60, defaultDurationMin: 180, bufferMin: 30,
    requiresResource: true, imageKey: 'podcast-control', locations: ['blr-studio'], resources: ['pod-video-set'], addOns: ['video-editing', 'social-clips'],
  },
  // --- Additional studio services listed in the studio-platform brief (sample values) ---
  {
    key: 'photo-studio-rental', brand: 'PHOTO', category: 'photography', slug: 'photography-studio-rental', name: 'Photography studio rental',
    summary: 'Hire a lit studio by the hour for your own shoot.',
    description: 'Self-operated studio hire for photographers and creators. Bring your own camera; studio facilities are listed once verified by the business.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(2000), minDurationMin: 60, maxDurationMin: 480, durationStepMin: 60, defaultDurationMin: 120, bufferMin: 30,
    requiresResource: true, imageKey: 'photo-commercial', locations: ['blr-studio'], resources: ['cyc-a', 'daylight-b'], addOns: ['hair-makeup'],
  },
  {
    key: 'interview-recording', brand: 'PODCAST', category: 'recording', slug: 'interview-recording', name: 'Interview recording',
    summary: 'Two-person interviews captured on audio and video.',
    description: 'A set-up for interviews and conversations with audio and camera coverage. Equipment details are placeholders until confirmed.',
    bookingMode: 'DIRECT', pricingModel: 'HOURLY', hourlyRateMinor: rupees(3000), minDurationMin: 60, maxDurationMin: 240, durationStepMin: 30, defaultDurationMin: 90, bufferMin: 30,
    requiresResource: true, imageKey: 'podcast-video', locations: ['blr-studio', 'bom-studio'], resources: ['pod-video-set', 'pod-multicam'], addOns: ['audio-editing', 'video-editing'],
  },
  {
    key: 'youtube-content', brand: 'PODCAST', category: 'production', slug: 'youtube-content-production', name: 'YouTube content production',
    summary: 'Batch-record videos for your channel in one studio day.',
    description: 'Plan, record and receive edited videos for your channel. Submitted as a request so the team can confirm format and crew before payment.',
    bookingMode: 'REQUEST', pricingModel: 'FIXED', basePriceMinor: rupees(25000), minDurationMin: 240, maxDurationMin: 480, durationStepMin: 60, defaultDurationMin: 240, bufferMin: 60,
    requiresResource: true, imageKey: 'podcast-multicam', locations: ['blr-studio', 'bom-studio'], resources: ['pod-video-set', 'pod-multicam'], addOns: ['video-editing', 'social-clips'],
    packages: [
      { slug: 'half-day', name: 'Half-day batch', description: 'Record several short videos in one session.', includes: ['4-hour studio session', 'Camera operator', 'Raw files'], priceMinor: rupees(25000), durationMin: 240 },
      { slug: 'full-day', name: 'Full-day batch', description: 'A full production day for a larger batch.', includes: ['8-hour studio session', 'Camera operator', 'Raw files'], priceMinor: rupees(42000), durationMin: 480, isFeatured: true },
    ],
  },
  {
    key: 'brand-campaign', brand: 'PHOTO', category: 'videography', slug: 'brand-and-advertising-shoots', name: 'Brand & advertising shoots',
    summary: 'Campaigns, multi-day shoots and custom projects, priced by quotation.',
    description: 'Large brand campaigns, multi-day shoots and complex productions are scoped individually. Send a project brief and the team will prepare a tailored quotation.',
    bookingMode: 'ENQUIRY', pricingModel: 'QUOTE', minDurationMin: 60, maxDurationMin: 1440, durationStepMin: 30, defaultDurationMin: 480, bufferMin: 60,
    requiresResource: true, imageKey: 'video-promo', locations: ['blr-studio'], resources: ['cyc-a', 'crew-1', 'crew-2'], addOns: [],
  },
  // --- Events ----------------------------------------------------------------------
  {
    key: 'consultation', brand: 'EVENTS', category: 'planning', slug: 'planning-consultation', name: 'Event planning consultation',
    summary: 'A one-hour planning session with an event lead.',
    description: 'Discuss your goals, guest experience and budget with an event lead. This is a directly bookable, fixed-price service.',
    bookingMode: 'DIRECT', pricingModel: 'FIXED', basePriceMinor: rupees(2500), minDurationMin: 60, maxDurationMin: 60, durationStepMin: 60, defaultDurationMin: 60, bufferMin: 15,
    requiresResource: true, imageKey: 'events-detail', locations: ['events-lounge'], resources: ['lounge'], addOns: ['moodboard'],
  },
  {
    key: 'corporate-events', brand: 'EVENTS', category: 'corporate', slug: 'corporate-event-management', name: 'Corporate event management',
    summary: 'Conferences, offsites and company celebrations, end to end.',
    description: 'Every corporate event is scoped individually. Submit an enquiry and the team will prepare a tailored quotation.',
    bookingMode: 'ENQUIRY', pricingModel: 'QUOTE', minDurationMin: 60, maxDurationMin: 1440, durationStepMin: 30, defaultDurationMin: 480, bufferMin: 120,
    requiresResource: true, imageKey: 'events-corporate', locations: ['garden-venue', 'ballroom-venue'], resources: ['garden', 'ballroom'], addOns: [],
  },
  {
    key: 'celebrations', brand: 'EVENTS', category: 'celebrations', slug: 'celebration-planning', name: 'Celebration planning',
    summary: 'Milestone birthdays, anniversaries and family gatherings.',
    description: 'From intimate dinners to large receptions. Pricing is provided by quotation after we understand your plans.',
    bookingMode: 'ENQUIRY', pricingModel: 'QUOTE', minDurationMin: 60, maxDurationMin: 1440, durationStepMin: 30, defaultDurationMin: 360, bufferMin: 120,
    requiresResource: true, imageKey: 'events-celebration', locations: ['garden-venue', 'ballroom-venue'], resources: ['garden', 'ballroom'], addOns: [],
  },
  {
    key: 'workshops', brand: 'EVENTS', category: 'workshops', slug: 'workshop-production', name: 'Workshop production',
    summary: 'Venue, materials and facilitation support for workshops.',
    description: 'We coordinate the space, materials and flow so facilitators can focus on participants.',
    bookingMode: 'ENQUIRY', pricingModel: 'QUOTE', minDurationMin: 60, maxDurationMin: 1440, durationStepMin: 30, defaultDurationMin: 300, bufferMin: 60,
    requiresResource: true, imageKey: 'events-workshop', locations: ['garden-venue', 'ballroom-venue'], resources: ['garden', 'ballroom'], addOns: [],
  },
  {
    key: 'launches', brand: 'EVENTS', category: 'launches', slug: 'product-launches', name: 'Product launches',
    summary: 'Reveals and press moments designed around your product.',
    description: 'Staging, guest flow and production for launch events. Scoped by quotation.',
    bookingMode: 'ENQUIRY', pricingModel: 'QUOTE', minDurationMin: 60, maxDurationMin: 1440, durationStepMin: 30, defaultDurationMin: 300, bufferMin: 180,
    requiresResource: true, imageKey: 'events-launch', locations: ['garden-venue', 'ballroom-venue'], resources: ['garden', 'ballroom'], addOns: [],
  },
  {
    key: 'private-events', brand: 'EVENTS', category: 'private', slug: 'private-events', name: 'Private events',
    summary: 'Invitation-only dinners and gatherings.',
    description: 'Discreet planning for private occasions. Submit an enquiry to begin.',
    bookingMode: 'ENQUIRY', pricingModel: 'QUOTE', minDurationMin: 60, maxDurationMin: 1440, durationStepMin: 30, defaultDurationMin: 240, bufferMin: 120,
    requiresResource: true, imageKey: 'events-dinner', locations: ['garden-venue', 'ballroom-venue'], resources: ['garden', 'ballroom'], addOns: [],
  },
];

export const portfolio: {
  brand: Brand;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  cover: string;
  images: string[];
}[] = [
  { brand: 'PHOTO', slug: 'studio-portrait-series', title: 'Studio portrait series', category: 'photography', summary: 'A sample editorial portrait set exploring warm, low-key light.', body: 'This is a demonstration project created with AI-generated imagery. It shows how a portrait case study will appear once the client supplies real, approved work.', cover: 'photo-portrait', images: ['photo-portrait', 'photo-hero', 'photo-architecture'] },
  { brand: 'PHOTO', slug: 'still-life-product-study', title: 'Still-life product study', category: 'photography', summary: 'A sample still-life set for a minimalist fragrance concept.', body: 'Demonstration content only. Product, styling and client are fictional.', cover: 'photo-product', images: ['photo-product'] },
  { brand: 'PHOTO', slug: 'campaign-day-behind-the-scenes', title: 'Campaign day, behind the scenes', category: 'photography', summary: 'A sample look at a cyclorama campaign production.', body: 'Demonstration content only. No real campaign is represented.', cover: 'photo-commercial', images: ['photo-commercial', 'photo-hero'] },
  { brand: 'PHOTO', slug: 'evening-reception-coverage', title: 'Evening reception coverage', category: 'photography', summary: 'A sample of candid event coverage.', body: 'Demonstration content only. Guests and event are fictional.', cover: 'photo-event', images: ['photo-event'] },
  { brand: 'PHOTO', slug: 'cafe-promotional-film', title: 'Café promotional film', category: 'videography', summary: 'A sample short-form film set-up with practical lighting.', body: 'Demonstration content only. Shown to illustrate how film projects and stills are presented.', cover: 'video-promo', images: ['video-promo'] },
  { brand: 'PHOTO', slug: 'leadership-interview', title: 'Leadership interview', category: 'videography', summary: 'A sample corporate interview set-up.', body: 'Demonstration content only.', cover: 'video-corporate', images: ['video-corporate'] },
  { brand: 'PHOTO', slug: 'light-and-concrete', title: 'Light and concrete', category: 'photography', summary: 'A sample architectural study.', body: 'Demonstration content only.', cover: 'photo-architecture', images: ['photo-architecture'] },
  { brand: 'PODCAST', slug: 'audio-room', title: 'Audio room', category: 'recording', summary: 'Sample imagery of a two-microphone audio room.', body: 'AI-generated sample imagery. Real room photographs and verified equipment lists will replace this.', cover: 'podcast-hero', images: ['podcast-hero', 'podcast-mic', 'podcast-detail'] },
  { brand: 'PODCAST', slug: 'video-set', title: 'Video podcast set', category: 'recording', summary: 'Sample imagery of a video podcast set.', body: 'AI-generated sample imagery.', cover: 'podcast-video', images: ['podcast-video', 'podcast-multicam'] },
  { brand: 'PODCAST', slug: 'edit-suite', title: 'Edit suite', category: 'production', summary: 'Sample imagery of an editing suite.', body: 'AI-generated sample imagery.', cover: 'podcast-control', images: ['podcast-control'] },
  { brand: 'PODCAST', slug: 'solo-booth-and-lounge', title: 'Solo booth and lounge', category: 'rental', summary: 'Sample imagery of a voice booth and guest lounge.', body: 'AI-generated sample imagery.', cover: 'podcast-booth', images: ['podcast-booth', 'podcast-lounge'] },
  { brand: 'EVENTS', slug: 'evening-gala', title: 'An evening gala', category: 'corporate', summary: 'Sample imagery of a long-table gala dinner.', body: 'AI-generated sample imagery. Not a real event delivered by the client.', cover: 'events-hero', images: ['events-hero', 'events-detail'] },
  { brand: 'EVENTS', slug: 'conference-day', title: 'Conference day', category: 'corporate', summary: 'Sample imagery of a corporate conference.', body: 'AI-generated sample imagery.', cover: 'events-corporate', images: ['events-corporate', 'events-venue'] },
  { brand: 'EVENTS', slug: 'garden-celebration', title: 'Garden celebration', category: 'celebrations', summary: 'Sample imagery of a garden celebration at dusk.', body: 'AI-generated sample imagery.', cover: 'events-celebration', images: ['events-celebration'] },
  { brand: 'EVENTS', slug: 'creative-workshop', title: 'Creative workshop', category: 'workshops', summary: 'Sample imagery of a loft workshop.', body: 'AI-generated sample imagery.', cover: 'events-workshop', images: ['events-workshop'] },
  { brand: 'EVENTS', slug: 'launch-night', title: 'Launch night', category: 'launches', summary: 'Sample imagery of a product reveal.', body: 'AI-generated sample imagery.', cover: 'events-launch', images: ['events-launch'] },
  { brand: 'EVENTS', slug: 'private-dinner', title: 'Private dinner', category: 'private', summary: 'Sample imagery of an intimate dinner setting.', body: 'AI-generated sample imagery.', cover: 'events-dinner', images: ['events-dinner', 'events-detail'] },
];

const commonFaqs = (brandName: string) => [
  { q: 'Is the information on this website final?', a: `No. This is a demonstration website for ${brandName}. Services, prices, schedules and locations are sample data and will be replaced with information verified by the business.` },
  { q: 'How do I check the status of my booking?', a: 'Use the Booking status page with your booking reference and the email address you used. Signed-in customers can also see their bookings under My account.' },
  { q: 'Is my booking confirmed when I submit the form?', a: 'Not automatically. A slot is held while you complete payment or while the team reviews your request. You will see the status change to Confirmed only after payment is verified or the team confirms it.' },
  { q: 'How are prices calculated?', a: 'All prices are calculated on our server from the current price list, including any add-ons and the applicable tax. You will always see an itemised breakdown before paying.' },
  { q: 'Can I pay online?', a: 'In this demonstration, checkout runs in a clearly labelled simulation mode and no money is taken. Live online payment will be enabled once the payment provider is connected.' },
];

export const faqs: Record<Brand, { q: string; a: string }[]> = {
  STUDIO: [
    { q: 'How do I book a studio session?', a: 'Choose a service, pick a package or duration, select a date and an available start time, then enter your details. Standard sessions are reserved immediately while you pay the deposit; some services are submitted as requests for the team to confirm. (Sample answer: the business will confirm its process.)' },
    { q: 'What equipment is included?', a: 'Each service page lists the facilities linked to it. Equipment marked "awaiting verification" will be confirmed by the studio; we do not publish specifications that have not been verified.' },
    { q: 'Can I bring my own camera or recording equipment?', a: 'Studio rental services are self-operated and assume you bring your own camera. For other services, please mention it in your booking notes. (Sample answer to be confirmed.)' },
    { q: 'Are editing services included?', a: 'Editing is included only where a package says so. Otherwise it can be added as an add-on, shown with its price before you book.' },
    { q: 'How long is each session?', a: 'Each service shows its minimum and maximum duration and the available package lengths. Hourly services can be booked in the steps shown on the booking panel.' },
    { q: 'What is the cancellation policy?', a: 'See the cancellation and refund policy page. Until the business publishes its final policy, paid bookings can be submitted as a cancellation request for the team to review.' },
    { q: 'Can I request a custom package?', a: 'Yes. Use "Request a quote" to send a project brief. The team reviews it and sends an itemised quotation; nothing is booked until you accept it.' },
    { q: 'How do I reschedule my booking?', a: 'Open your booking from the confirmation link or your account and choose "Request a new time". Your original slot stays reserved until the team approves the change.' },
  ],
  PHOTO: [
    ...commonFaqs('Lumen Studio'),
    { q: 'Do you photograph on location?', a: 'Event photography and video production can take place on location. The crew is scheduled through the same availability system as the studios.' },
  ],
  PODCAST: [
    ...commonFaqs('Signal Room'),
    { q: 'What equipment is in each room?', a: 'Verified equipment lists will be published once confirmed by the studio. We do not list specifications that have not been verified.' },
    { q: 'Can two shows book the same room at once?', a: 'No. Each room is an exclusive resource; the booking system prevents overlapping reservations, including turnaround time between sessions.' },
  ],
  EVENTS: [
    ...commonFaqs('Atelier Events'),
    { q: 'Does submitting an enquiry book my date?', a: 'No. An enquiry starts a conversation. The team reviews it, prepares a quotation, and only converts it into a booking once you accept the proposal and the date is confirmed available.' },
    { q: 'Can I book anything directly?', a: 'Yes. Planning consultations have a fixed price and can be booked directly from the Booking page. Full events are quoted individually.' },
  ],
};

// --- Studio discovery platform --------------------------------------------------------

export const discoveryCategories = [
  { slug: 'photography', name: 'Photography', description: 'Portrait, fashion, product and commercial photography.', imageKey: 'photo-portrait' },
  { slug: 'videography', name: 'Videography', description: 'Promotional films, interviews and corporate video.', imageKey: 'video-promo' },
  { slug: 'podcasting', name: 'Podcast Studio', description: 'Audio and video podcast recording.', imageKey: 'podcast-hero' },
  { slug: 'video-production', name: 'Video Production', description: 'Directed, multi-camera and channel content production.', imageKey: 'podcast-multicam' },
  { slug: 'studio-rental', name: 'Studio Rental', description: 'Hire studio space by the hour.', imageKey: 'podcast-booth' },
  { slug: 'product-shoots', name: 'Product Shoots', description: 'Catalogue and campaign product imagery.', imageKey: 'photo-product' },
  { slug: 'commercial-production', name: 'Commercial Production', description: 'Brand campaigns and advertising shoots.', imageKey: 'photo-commercial' },
  { slug: 'events', name: 'Events', description: 'Corporate events, celebrations, workshops and launches.', imageKey: 'events-hero' },
];

/** Service key → discovery category slugs. */
export const serviceDiscovery: Record<string, string[]> = {
  portrait: ['photography'],
  product: ['photography', 'product-shoots'],
  commercial: ['photography', 'commercial-production'],
  'event-photo': ['photography'],
  'promo-video': ['videography', 'video-production', 'commercial-production'],
  'corporate-video': ['videography', 'video-production'],
  'audio-recording': ['podcasting'],
  'video-podcast': ['podcasting', 'videography'],
  multicam: ['podcasting', 'video-production'],
  'studio-rental': ['podcasting', 'studio-rental'],
  'custom-production': ['podcasting', 'video-production'],
  'photo-studio-rental': ['photography', 'studio-rental'],
  'interview-recording': ['videography', 'podcasting'],
  'youtube-content': ['video-production', 'videography'],
  'brand-campaign': ['commercial-production', 'videography', 'photography'],
  consultation: ['events'],
  'corporate-events': ['events'],
  celebrations: ['events'],
  workshops: ['events'],
  launches: ['events'],
  'private-events': ['events'],
};

/** Sample coupons so the offers feature can be demonstrated. Clearly labelled; replace with real offers. */
export const offers = [
  { code: 'DEMO10', title: '10% off your first studio session (sample offer)', description: 'Sample offer for the demo: 10% off, up to ₹1,000.', terms: 'Sample terms for demonstration. One use per customer.', discountType: 'PERCENT' as const, value: 1000, maxDiscountMinor: 100_000, minOrderMinor: 200_000, perCustomerLimit: 1, imageKey: 'photo-hero' },
  { code: 'PODCAST500', title: '₹500 off podcast recording (sample offer)', description: 'Sample offer for the demo on podcast sessions.', terms: 'Sample terms for demonstration. Valid on podcast recording services only.', discountType: 'FLAT' as const, value: 50_000, maxDiscountMinor: null, minOrderMinor: 300_000, perCustomerLimit: 2, imageKey: 'podcast-hero', services: ['audio-recording', 'video-podcast', 'multicam'] },
];

export const featuredServices = ['portrait', 'video-podcast', 'promo-video', 'product', 'photo-studio-rental'];

export const servicePreparation: Record<string, string> = {
  portrait: 'Bring two or three outfits and any styling references. Arrive 10 minutes early. (Sample guidance: to be confirmed by the studio.)',
  product: 'Send the product list in advance and bring clean, unpackaged items. (Sample guidance.)',
  'video-podcast': 'Share the episode format and number of guests when booking. (Sample guidance.)',
  'audio-recording': 'Headphones are provided; arrive with your running order. (Sample guidance.)',
  'photo-studio-rental': 'Self-operated: bring your own camera. Studio facilities will be listed once verified. (Sample guidance.)',
};

export const serviceGallery: Record<string, string[]> = {
  portrait: ['photo-hero', 'photo-architecture'],
  product: ['photo-commercial'],
  'video-podcast': ['podcast-multicam', 'podcast-detail'],
  'audio-recording': ['podcast-hero', 'podcast-detail'],
  'promo-video': ['video-corporate'],
  'photo-studio-rental': ['photo-hero'],
};

/** Facilities and equipment. Unverified: generic descriptions only, no models or specifications. */
export const equipment = [
  { key: 'cyclorama', name: 'Cyclorama wall', category: 'Studio space', imageKey: 'photo-commercial', services: ['portrait', 'product', 'commercial', 'photo-studio-rental', 'brand-campaign'] },
  { key: 'lighting', name: 'Studio lighting', category: 'Lighting', imageKey: 'photo-hero', services: ['portrait', 'product', 'commercial', 'photo-studio-rental', 'promo-video'] },
  { key: 'backdrops', name: 'Photography backdrops', category: 'Studio space', imageKey: 'photo-portrait', services: ['portrait', 'photo-studio-rental'] },
  { key: 'mics', name: 'Podcast microphones', category: 'Audio', imageKey: 'podcast-mic', services: ['audio-recording', 'video-podcast', 'multicam', 'studio-rental', 'interview-recording'] },
  { key: 'mixing', name: 'Audio recording desk', category: 'Audio', imageKey: 'podcast-control', services: ['audio-recording', 'video-podcast', 'multicam', 'custom-production'] },
  { key: 'cameras', name: 'Multi-camera video set-up', category: 'Video', imageKey: 'podcast-multicam', services: ['video-podcast', 'multicam', 'interview-recording', 'youtube-content'] },
  { key: 'booth', name: 'Acoustically treated rooms', category: 'Studio space', imageKey: 'podcast-booth', services: ['audio-recording', 'studio-rental'] },
  { key: 'lounge', name: 'Guest lounge', category: 'Amenities', imageKey: 'podcast-lounge', services: [] },
];

export const banners = [
  { title: 'Studio photography, booked in minutes', subtitle: 'Portraits, products and campaigns with live availability and itemised pricing.', imageKey: 'photo-hero', ctaLabel: 'Explore photography', ctaHref: '/services/photography' },
  { title: 'Record your podcast in a treated studio', subtitle: 'Audio and video podcast sessions across two studio locations.', imageKey: 'podcast-hero', ctaLabel: 'Book podcast studio', ctaHref: '/services/podcasting' },
  { title: 'Films and video production', subtitle: 'Promotional films, interviews and channel content.', imageKey: 'video-promo', ctaLabel: 'See video services', ctaHref: '/services/video-production' },
];

export const contentPages = [
  { slug: 'privacy', title: 'Privacy policy', body: 'TEMPLATE FOR REVIEW. This placeholder has not been approved by the business.\n\nWhat we collect: the details you enter when you book, enquire or contact us (name, email, optional phone, project details and any files you attach).\n\nHow we use it: to manage your booking or enquiry and to contact you about it. We do not sell your data.\n\nPayments are handled by the payment provider; this website never stores full card details.\n\nYou can update your profile from your account and ask us to correct or delete your information, subject to legal record-keeping requirements.' },
  { slug: 'terms', title: 'Terms and conditions', body: 'TEMPLATE FOR REVIEW. This placeholder has not been approved by the business.\n\nA booking is confirmed only when its status shows Confirmed. Submitting a form or enquiry does not by itself confirm a booking.\n\nPrices are calculated by our system at the time of booking and shown with an itemised breakdown before payment. Prices on this demonstration site are samples.' },
  { slug: 'cancellation-refund', title: 'Cancellation and refund policy', body: 'TEMPLATE FOR REVIEW. The business has not yet supplied its cancellation and refund policy.\n\nUntil it is confirmed: unpaid bookings can be cancelled online; paid bookings can be submitted as a cancellation request, which the team reviews. Refund eligibility will follow the policy the business publishes here.' },
];
