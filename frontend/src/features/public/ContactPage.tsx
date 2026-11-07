import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Mail,
  Phone,
  Building2,
  Clock,
  CheckCircle2,
  Send,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { contactApi } from '@/api/contactService';
import { ContactQueryCreatePayload } from '@/types/contact';
import { Button, Input, Card, toast } from '@/components/ui';
import { Link } from 'react-router-dom';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  organization_name: z.string().optional(),
  service_interested: z.string().min(1, 'Please select a service'),
  subject: z.string().min(3, 'Please enter a brief subject'),
  message: z.string().min(10, 'Message must be at least 10 characters long'),
  challenge_answer: z.string().min(1, 'Please solve the security verification'),
  website_trap: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const ContactPage: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    ticket_id: string;
    name: string;
    email: string;
    submitted_at: string;
  } | null>(null);

  // Anti-bot timing & security verification challenge
  const [formRenderTime] = useState<number>(() => Date.now());
  const [activeChallenge, setActiveChallenge] = useState<{ question: string; token: string } | null>(null);
  const [refreshingChallenge, setRefreshingChallenge] = useState(false);

  // Dynamically load configured Support Email & Helpline Number
  const { data: publicInfo } = useQuery({
    queryKey: ['publicContactInfo'],
    queryFn: () => contactApi.getPublicInfo(),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (publicInfo?.challenge_question && publicInfo?.challenge_token) {
      setActiveChallenge({
        question: publicInfo.challenge_question,
        token: publicInfo.challenge_token,
      });
    }
  }, [publicInfo]);

  const handleRefreshChallenge = async () => {
    setRefreshingChallenge(true);
    try {
      const fresh = await contactApi.getChallenge();
      setActiveChallenge(fresh);
    } catch {
      toast.error('Unable to refresh verification question. Please try again.');
    } finally {
      setRefreshingChallenge(false);
    }
  };

  const supportEmail = publicInfo?.support_email || 'support@trustmylab.in';
  const contactPhone = publicInfo?.contact_phone || '+91 94150 05517';
  const officeAddress = publicInfo?.office_address || 'Cyber City, Block A, Gurugram, India';
  const workingHours = publicInfo?.working_hours || 'Monday – Saturday: 8:00 AM – 8:00 PM IST';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      organization_name: '',
      service_interested: 'Diagnostic Center LIMS',
      subject: '',
      message: '',
      challenge_answer: '',
      website_trap: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setSubmitting(true);
    try {
      const payload: ContactQueryCreatePayload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        organization_name: data.organization_name,
        service_interested: data.service_interested,
        subject: data.subject,
        message: data.message,
        website_trap: data.website_trap || undefined,
        client_time_ms: Date.now() - formRenderTime,
        challenge_answer: data.challenge_answer,
        challenge_token: activeChallenge?.token,
      };

      const res = await contactApi.submitContact(payload);
      if (res.success && res.data) {
        setSubmittedData(res.data);
        toast.success('Your message has been sent successfully!');
        reset();
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Unable to send message at this time. Please try again.';
      toast.error(errorMsg);
      // Automatically refresh challenge on verification error
      handleRefreshChallenge();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-slate-50">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 bg-gradient-to-b from-slate-900 via-brand-950 to-slate-900 text-white">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-brand-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-brand-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>We Are Here to Assist Your Clinical Operations</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Get in Touch with Our{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-400 to-teal-300">
                Diagnostic Specialists
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Have questions regarding test catalog pricing, automated reference ranges, barcode
              accessioning, or ultrasound templates? Send us a query and our team will get back to
              you promptly.
            </p>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: FORM CARD */}
          <div className="lg:col-span-7 xl:col-span-8">
            <Card className="p-6 sm:p-8 bg-white border border-slate-200/90 shadow-xl rounded-2xl">
              {submittedData ? (
                <div className="py-8 text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Thank You, {submittedData.name}!
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      Your service inquiry has been safely delivered to our diagnostic desk and a
                      confirmation receipt was mailed to{' '}
                      <span className="font-semibold text-slate-900">{submittedData.email}</span>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left max-w-md mx-auto text-xs space-y-1.5 font-mono">
                    <p className="text-slate-500">
                      <strong>Reference Ticket:</strong> #{submittedData.ticket_id.slice(0, 13)}
                    </p>
                    <p className="text-slate-500">
                      <strong>Submission Timestamp:</strong> {submittedData.submitted_at}
                    </p>
                    <p className="text-emerald-700 font-semibold">
                      <strong>Status:</strong> Acknowledged & Under Review
                    </p>
                  </div>

                  <div className="pt-3 flex justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setSubmittedData(null)}
                      className="text-xs"
                    >
                      Submit Another Inquiry
                    </Button>
                    <Link to="/pricing">
                      <Button variant="primary" className="text-xs gap-1.5">
                        Explore Plans & Pricing <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="border-b border-slate-100 pb-5 mb-6">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Send a Query Regarding Our Services
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Fill out the form below. Your request will be directly dispatched to our
                      specialist desk.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Full Name *
                        </label>
                        <Input
                          placeholder="e.g. Dr. Rajesh Sharma"
                          error={errors.name?.message}
                          {...register('name')}
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Work / Official Email *
                        </label>
                        <Input
                          type="email"
                          placeholder="doctor@citypathology.com"
                          error={errors.email?.message}
                          {...register('email')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Phone */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Phone Number (Optional)
                        </label>
                        <Input
                          placeholder="+91 98765 43210"
                          error={errors.phone?.message}
                          {...register('phone')}
                        />
                      </div>

                      {/* Organization */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Laboratory / Facility Name
                        </label>
                        <Input
                          placeholder="e.g. City Diagnostic Center"
                          error={errors.organization_name?.message}
                          {...register('organization_name')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Service of Interest */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Service of Interest
                        </label>
                        <select
                          className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                          {...register('service_interested')}
                        >
                          <option value="Diagnostic Center LIMS">Diagnostic Center LIMS</option>
                          <option value="Multi-Branch Franchise Chain">Multi-Branch Franchise Chain</option>
                          <option value="Hospital Pathology Integration">Hospital Pathology Integration</option>
                          <option value="Ultrasound & Imaging Reporting">Ultrasound & Imaging Reporting</option>
                          <option value="Automated Doctor Commission Engine">Automated Doctor Commission Engine</option>
                          <option value="Custom Enterprise Pricing & SLA">Custom Enterprise Pricing & SLA</option>
                          <option value="General Technical Inquiry">General Technical Inquiry</option>
                        </select>
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Subject *
                        </label>
                        <Input
                          placeholder="e.g. Inquiry regarding multi-branch onboarding"
                          error={errors.subject?.message}
                          {...register('subject')}
                        />
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Detailed Query / Requirements *
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Please describe your laboratory requirements, daily patient volume, current software challenges, or any specific customizations you need..."
                        className={`w-full p-3 text-sm rounded-md border ${
                          errors.message ? 'border-rose-500 ring-rose-500' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white shadow-xs`}
                        {...register('message')}
                      />
                      {errors.message && (
                        <p className="text-xs text-rose-600 mt-1">{errors.message.message}</p>
                      )}
                    </div>

                    {/* Bot Protection / Human Verification Challenge */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-brand-600" />
                          Security Verification *
                        </label>
                        <button
                          type="button"
                          onClick={handleRefreshChallenge}
                          disabled={refreshingChallenge}
                          className="text-[11px] font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
                          title="Generate a new question"
                        >
                          <RefreshCw className={`w-3 h-3 ${refreshingChallenge ? 'animate-spin' : ''}`} />
                          Refresh Question
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 shadow-2xs font-mono tracking-wide">
                          {activeChallenge?.question || 'Security Check: What is 7 + 5?'}
                        </div>
                        <div className="w-full sm:w-36">
                          <Input
                            type="text"
                            placeholder="Your answer"
                            error={errors.challenge_answer?.message}
                            {...register('challenge_answer')}
                            className="font-mono text-center font-bold text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Please answer this simple question to confirm you are a human visitor.
                      </p>
                    </div>

                    {/* Anti-Bot Honeypot Trap (invisible to real human users) */}
                    <div
                      className="opacity-0 absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden"
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <label htmlFor="website_trap">Leave this blank</label>
                      <input
                        id="website_trap"
                        type="text"
                        autoComplete="off"
                        tabIndex={-1}
                        {...register('website_trap')}
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting}
                        className="w-full sm:w-auto px-8 py-2.5 font-semibold text-sm shadow-md shadow-brand-600/20 gap-2"
                      >
                        {submitting ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Dispatching Your Query...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" /> Send Inquiry to Service Desk
                          </>
                        )}
                      </Button>
                    </div>

                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Your details are transmitted over encrypted TLS 1.3 and are strictly confidential under HIPAA standards.
                    </p>
                  </form>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT: CONTACT INFO & TRUST SIGNALS */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Direct Contact Card */}
            <Card className="p-6 bg-white border border-slate-200/90 shadow-md rounded-2xl space-y-5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" /> Direct Specialist Contact
              </h3>

              <div className="space-y-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Support Email
                    </span>
                    <a
                      href={`mailto:${supportEmail}`}
                      className="text-slate-900 font-semibold hover:text-brand-600 transition-colors"
                    >
                      {supportEmail}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Helpline & Contact Number
                    </span>
                    <a
                      href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                      className="text-slate-900 font-semibold hover:text-teal-600 transition-colors"
                    >
                      {contactPhone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Response SLA & Hours
                    </span>
                    <p className="text-slate-900 font-medium text-xs">
                      {workingHours}
                    </p>
                  </div>
                </div>

                {officeAddress && (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Headquarters & Operations
                      </span>
                      <p className="text-slate-900 font-medium text-xs">
                        {officeAddress}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Free 14-day full platform access
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  No credit card required for consultation
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Complimentary catalog migration support
                </div>
              </div>
            </Card>

            {/* Quick Consultation Callout */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-900 to-slate-900 text-white shadow-md space-y-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
                <Sparkles className="w-3 h-3 text-brand-400" /> Live Product Demo
              </span>
              <h4 className="text-sm font-bold">Want to see TrustMyLab in action?</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Schedule a 20-minute tailored walkthrough of our multi-tenant LIMS, automated reference flag analyzer, and sealed QR reporting engine.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:text-white transition-colors pt-1"
              >
                Compare Enterprise Editions &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
