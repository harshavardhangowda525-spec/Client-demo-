export const PERMISSIONS = {
  'bookings.read': 'View bookings and their history',
  'bookings.manage': 'Approve, reject, confirm, reschedule and cancel bookings',
  'enquiries.read': 'View event enquiries',
  'enquiries.manage': 'Update enquiries, add follow-ups and prepare quotations',
  'catalog.read': 'View services, packages and add-ons',
  'catalog.manage': 'Create and edit services, packages and add-ons',
  'locations.manage': 'Manage locations, resources, opening hours and blocked periods',
  'customers.read': 'View customer records',
  'payments.read': 'View payment orders, transactions and refunds',
  'payments.refund': 'Issue refunds',
  'content.manage': 'Manage portfolio, galleries, FAQs and contact messages',
  'notifications.read': 'View notification records and development previews',
  'settings.read': 'View business configuration',
  'settings.manage': 'Change business configuration and integrations',
  'audit.read': 'View audit logs',
  'users.manage': 'Manage staff accounts and roles',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLE_DEFINITIONS: Record<
  string,
  { name: string; description: string; isStaff: boolean; permissions: PermissionKey[] }
> = {
  admin: { name: 'Administrator', description: 'Full access', isStaff: true, permissions: ALL },
  manager: {
    name: 'Manager',
    description: 'Operations, catalogue, payments and audit access without staff or configuration management',
    isStaff: true,
    permissions: ALL.filter((p) => p !== 'users.manage' && p !== 'settings.manage'),
  },
  staff: {
    name: 'Staff',
    description: 'Day-to-day bookings and enquiries',
    isStaff: true,
    permissions: [
      'bookings.read',
      'bookings.manage',
      'enquiries.read',
      'enquiries.manage',
      'catalog.read',
      'customers.read',
      'payments.read',
      'content.manage',
      'notifications.read',
    ],
  },
  customer: { name: 'Customer', description: 'Website customer', isStaff: false, permissions: [] },
};
