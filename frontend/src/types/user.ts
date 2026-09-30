import { UserRole } from './auth';

export interface UserResponse {
  id: string;
  lab_id?: string | null;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  signature_image_url?: string | null;
  medical_license_number?: string | null;
  qualifications?: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  medical_license_number?: string;
  qualifications?: string;
}

export interface UserUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: UserRole;
  medical_license_number?: string;
  qualifications?: string;
  is_active?: boolean;
}
