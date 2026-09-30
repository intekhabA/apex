export type UserRole =
  | 'SUPER_ADMIN'
  | 'LAB_ADMIN'
  | 'LAB_ASSISTANT'
  | 'PATHOLOGIST'
  | 'RADIOLOGIST'
  | 'RECEPTIONIST'
  | 'PATIENT';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  medical_license_number?: string | null;
  qualifications?: string | null;
  signature_image_url?: string | null;
  lab_id?: string | null;
  lab_name?: string | null;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginSuccessData {
  user: UserProfile;
  tokens: TokenResponse;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}
