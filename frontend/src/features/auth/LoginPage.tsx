import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Input, Button, Alert } from '@/components/ui';
import { AuthLayout } from '@/layouts/AuthLayout';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@demolab.com',
      password: 'LabAdmin@2026!',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage(null);
    try {
      await login(data);
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
    <AuthLayout>
      <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 text-brand-600 mb-3 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Sign In to DiagnoLab
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Access your laboratory workstation or patient portal
          </p>
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
