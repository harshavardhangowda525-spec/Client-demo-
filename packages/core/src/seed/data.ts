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
