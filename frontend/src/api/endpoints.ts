export const API_ENDPOINTS = {
  HEALTH: '/health',
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
    LOGOUT: '/auth/logout',
  },
  ADMIN: {
    LABS: '/admin/laboratories',
    USERS: '/admin/users',
    STATS: '/admin/stats',
  },
  LAB: {
    SETTINGS: '/lab/settings',
    STAFF: '/lab/staff',
    PROFILE: '/lab/profile',
  },
  PATIENTS: {
    BASE: '/patients',
  },
  TESTS: {
    CATEGORIES: '/tests/categories',
    TESTS: '/tests',
    PACKAGES: '/tests/packages',
    PRICING: '/tests/pricing',
  },
  BOOKINGS: {
    BASE: '/bookings',
  },
  SAMPLES: {
    BASE: '/samples',
  },
  RESULTS: {
    BASE: '/results',
  },
  REPORTS: {
    BASE: '/reports',
    VERIFY: (token: string) => `/reports/verify/${token}`,
  },
  INVOICES: {
    BASE: '/invoices',
    PAYMENTS: '/invoices/payments',
  },
  AUDIT: {
    LOGS: '/audit/logs',
  },
  DOCTORS: {
    BASE: '/doctors',
    COMMISSIONS: (doctorId: string) => `/doctors/${doctorId}/commissions`,
  },
  COMMISSIONS: {
    REPORT: '/commissions/report',
  },
} as const;
