import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/authService';
import { Input, Button, Alert } from '@/components/ui';
import { AuthLayout } from '@/layouts/AuthLayout';
import { LabBranding } from '@/types';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [labBranding, setLabBranding] = useState<LabBranding | null>(() => {
    try {
      const saved = localStorage.getItem('diagnolab_last_lab_branding');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@demolab.com',
      password: 'LabAdmin@2026!',
    },
  });

  const emailValue = watch('email');

  // Check URL parameters for explicit lab identification (?code=LAB001 or ?lab=UUID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || params.get('lab');
    if (codeParam) {
      authApi
        .getLabBranding({ lab_code: codeParam, lab_id: codeParam })
        .then((res) => {
          if (res) {
            setLabBranding(res);
            localStorage.setItem('diagnolab_last_lab_branding', JSON.stringify(res));
          }
        });
    }
  }, []);

  // Debounced branding lookup as user enters email address
  useEffect(() => {
    if (!emailValue || !emailValue.includes('@') || emailValue.length < 5) return;
    const timer = setTimeout(async () => {
      const res = await authApi.getLabBranding({ email: emailValue });
      if (res) {
        setLabBranding(res);
        localStorage.setItem('diagnolab_last_lab_branding', JSON.stringify(res));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [emailValue]);

  const handleClearBranding = () => {
    setLabBranding(null);
    localStorage.removeItem('diagnolab_last_lab_branding');
  };

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage(null);
    try {
      const res = await login(data);
      if (res?.user?.lab_id && res?.user?.lab_name) {
        const branding: LabBranding = {
          lab_id: res.user.lab_id,
          lab_code: '',
          lab_name: res.user.lab_name,
          logo_url: res.user.lab_logo_url || null,
        };
        localStorage.setItem('diagnolab_last_lab_branding', JSON.stringify(branding));
        setLabBranding(branding);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Authentication failed. Please verify your credentials.';
      setErrorMessage(msg);
    }
  };

  const handleQuickFill = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
    setErrorMessage(null);
  };

  return (
    <AuthLayout labBranding={labBranding}>
      <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="text-center mb-8">
          {labBranding?.logo_url ? (
            <div className="mx-auto mb-3 flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-slate-200 p-2 shadow-md">
              <img
                src={`/storage/${labBranding.logo_url.replace(/^(\.\/)?storage\//, '')}`}
                alt={labBranding.lab_name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 text-brand-600 mb-3 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
          )}
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {labBranding?.lab_name ? `Sign In to ${labBranding.lab_name}` : 'Sign In to TrustMyLab'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {labBranding?.lab_name
              ? 'Enter your credentials to access laboratory workstation'
              : 'Access your laboratory workstation or patient portal'}
          </p>

          {labBranding && (
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                {labBranding.lab_code ? `Lab Code: ${labBranding.lab_code}` : 'Custom Lab'}
              </span>
              <button
                type="button"
                onClick={handleClearBranding}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline font-medium"
              >
                Reset Default
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <Alert type="error" className="mb-6" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Work Email Address"
            type="email"
            placeholder="doctor@demolab.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-semibold"
              isLoading={isLoggingIn}
            >
              Sign In to Workstation
            </Button>
          </div>
        </form>

        {/* Quick Demo Login Preset Buttons for easy testing across all roles */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> Quick Demo Role Switcher:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@demolab.com', 'LabAdmin@2026!')}
              className="p-2 text-left rounded-lg bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 transition-colors"
            >
              <span className="font-bold block">Lab Admin</span>
              <span className="text-[11px] text-slate-500">admin@demolab.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('pathologist@demolab.com', 'Pathologist@2026!')}
              className="p-2 text-left rounded-lg bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors"
            >
              <span className="font-bold block">Pathologist</span>
              <span className="text-[11px] text-slate-500">pathologist@demolab.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('radiologist@demolab.com', 'Radiologist@2026!')}
              className="p-2 text-left rounded-lg bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors"
            >
              <span className="font-bold block">Radiologist</span>
              <span className="text-[11px] text-slate-500">radiologist@demolab.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('admin@example.com', 'SuperAdmin@2026!')}
              className="p-2 text-left rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 transition-colors"
            >
              <span className="font-bold block">Super Admin</span>
              <span className="text-[11px] text-slate-500">admin@example.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('assistant@demolab.com', 'Assistant@2026!')}
              className="p-2 text-left rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            >
              <span className="font-bold block">Lab Assistant</span>
              <span className="text-[11px] text-slate-500">assistant@demolab.com</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('patient@example.com', 'Patient@2026!')}
              className="p-2 text-left rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 transition-colors"
            >
              <span className="font-bold block">Patient</span>
              <span className="text-[11px] text-slate-500">patient@example.com</span>
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
