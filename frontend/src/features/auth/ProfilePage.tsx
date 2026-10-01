import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Shield,
  Building2,
  KeyRound,
  FileBadge,
  Phone,
  PenTool,
  Upload,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/authService';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, Badge, Alert } from '@/components/ui';

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters long'),
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "New passwords don't match",
    path: ['confirm_password'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export const ProfilePage: React.FC = () => {
  const { user, changePassword, isChangingPassword } = useAuth();
  const { updateUser } = useAuthStore();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sigMessage, setSigMessage] = useState<string | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      setSuccessMessage('Password changed successfully! Keep your new password secure.');
      reset();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update password. Please check your current password.'
      );
    }
  };

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSig(true);
    setSigMessage(null);
    setSigError(null);
    try {
      const updated = await authApi.uploadSignature(file);
      updateUser(updated);
      setSigMessage('Personal diagnostic signature image uploaded successfully.');
    } catch (err: any) {
      setSigError(err?.response?.data?.detail || err?.message || 'Failed to upload signature image');
    } finally {
      setIsUploadingSig(false);
      e.target.value = '';
    }
  };

  const handleSigDelete = async () => {
    if (!window.confirm('Remove your personal signature and revert to standard certified signature?')) return;
    setIsUploadingSig(true);
    setSigMessage(null);
    setSigError(null);
    try {
      const updated = await authApi.deleteSignature();
      updateUser(updated);
      setSigMessage('Personal signature removed.');
    } catch (err: any) {
      setSigError(err?.response?.data?.detail || err?.message || 'Failed to remove signature');
    } finally {
      setIsUploadingSig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Account & Security</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your credentials, professional medical details, and manage password security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: User Profile Overview & Signature */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="text-center pt-8">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-50 border-2 border-brand-200 flex items-center justify-center text-brand-700 text-2xl font-black shadow-inner mb-4">
                {user?.first_name?.[0]}
                {user?.last_name?.[0]}
              </div>
              <h2 className="text-lg font-bold text-slate-900">{user?.full_name}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="mt-3">
                <Badge variant="brand">{user?.role}</Badge>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 text-left space-y-3 text-sm">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">
                    <strong>Laboratory:</strong>{' '}
                    {user?.lab_name || (user?.role === 'SUPER_ADMIN' ? 'Platform Wide' : 'N/A')}
                  </span>
                </div>
                {user?.phone && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user?.medical_license_number && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <FileBadge className="w-4 h-4 text-teal-500 shrink-0" />
                    <span>
                      <strong>License:</strong> {user.medical_license_number}
                    </span>
                  </div>
                )}
                {user?.qualifications && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Shield className="w-4 h-4 text-brand-500 shrink-0" />
                    <span>
                      <strong>Degrees:</strong> {user.qualifications}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Diagnostic Signature Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PenTool className="w-4 h-4 text-teal-600" /> Diagnostic Report Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500">
                This signature is automatically embedded when you approve or finalize medical diagnostic reports.
              </p>

              {sigMessage && (
                <Alert type="success" onDismiss={() => setSigMessage(null)}>
                  {sigMessage}
                </Alert>
              )}
              {sigError && (
                <Alert type="error" onDismiss={() => setSigError(null)}>
                  {sigError}
                </Alert>
              )}

              <div className="h-20 w-full bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center p-2 shadow-inner overflow-hidden">
                {user?.signature_image_url ? (
                  <img
                    src={`/storage/${user.signature_image_url.replace(/^(\.\/)?storage\//, '')}`}
                    alt="Doctor Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-xs text-slate-400">
                    <p className="italic">No personal signature uploaded</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Using standard certified system signature</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingSig ? 'Uploading...' : 'Upload Signature'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={isUploadingSig}
                    onChange={handleSigUpload}
                  />
                </label>
                {user?.signature_image_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 text-xs"
                    onClick={handleSigDelete}
                    disabled={isUploadingSig}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Change Password */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-brand-600" /> Change Account Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              {successMessage && (
                <Alert type="success" className="mb-6" onDismiss={() => setSuccessMessage(null)}>
                  {successMessage}
                </Alert>
              )}
              {errorMessage && (
                <Alert type="error" className="mb-6" onDismiss={() => setErrorMessage(null)}>
                  {errorMessage}
                </Alert>
              )}

              <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-lg">
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="••••••••••••"
                  error={errors.current_password?.message}
                  {...register('current_password')}
                />

                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••••••"
                  helperText="Must be at least 8 characters long"
                  error={errors.new_password?.message}
                  {...register('new_password')}
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••••••"
                  error={errors.confirm_password?.message}
                  {...register('confirm_password')}
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isChangingPassword}
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
