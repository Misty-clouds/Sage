// ─── API Envelope ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  timestamp: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'hr_admin' | 'auditor' | 'employee';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  orgName: string;
  role: UserRole;
}

export interface InvitePayload {
  name: string;
  email: string;
  role: 'auditor' | 'employee';
  accountNumber?: string;
  phone?: string;
  salary?: string;
}

export interface RequestOtpPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  role: UserRole;
  orgId: string;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  orgName: string;
  orgId: string;
}

// ─── Employees ────────────────────────────────────────────────────────────────

export type ServerEmployeeStatus = 'CLEAR' | 'REVIEW' | 'FROZEN' | 'PENDING' | 'FLAGGED';

export interface Employee {
  _id: string;
  orgId: string;
  name: string;
  roleTitle: string;
  accountNumber: string | null;
  phone: string | null;
  email: string | null;
  dnaScore: number | null;
  status: ServerEmployeeStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResponse {
  data: Employee[];
  total: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  warnings: string[];
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

export interface SalaryEntry {
  employeeId: string;
  amount: number;
}

export interface PayrollSchedule {
  _id: string;
  orgId: string;
  disbursementDay: number;
  smsHoursBefore: number;
  salaryAmounts: SalaryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSchedulePayload {
  disbursementDay?: number;
  smsHoursBefore?: number;
  squadApiKey?: string;
}
