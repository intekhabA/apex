import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { reportService } from '@/api/reportService';
import { PublicVerification } from '@/types';
import { CheckCircle2, XCircle, ShieldCheck, Building2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui';

export const PublicVerificationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Verification token is missing.');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await reportService.verifyReportPublic(token);
        setData(res);
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { message?: string } } };
        setError(
          errorObj.response?.data?.message ||
            'Unable to verify report. The verification token is invalid or has expired.'
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto w-full">
        {/* Platform Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-teal-500/20">
              DL
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">DiagnoLab</span>
          </div>
          <p className="text-xs uppercase tracking-widest font-semibold text-teal-700">
            Public Digital Signature &amp; Authenticity Verification Registry
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-700">
              Querying cryptographic integrity registry...
            </p>
          </div>
        )}

        {/* Error / Invalid State */}
        {!loading && error && (
          <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Verification Failed</h2>
              <p className="text-xs text-rose-600 mt-1 max-w-sm mx-auto">{error}</p>
            </div>
            <p className="text-xs text-slate-400">
              If you believe this is an error, please contact the issuing laboratory or verify you scanned the correct QR code on the medical document.
            </p>
          </div>
        )}

        {/* Verified Authentic State */}
        {!loading && data && data.is_valid && (
          <div className="bg-white rounded-2xl border border-teal-200 shadow-lg shadow-teal-500/5 overflow-hidden">
            {/* Top Verified Banner */}
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 text-white text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                Authentic Medical Report
              </h2>
              <p className="text-xs text-teal-100 mt-1 font-medium">
                Cryptographically validated against laboratory records
              </p>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-5 text-sm">
              {/* Lab Accreditation */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Building2 className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Issuing Laboratory
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{data.lab_name}</span>
                </div>
              </div>

              {/* Masked Patient & Test Details */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">
                    Patient (Masked for Privacy)
                  </span>
                  <span className="font-semibold text-slate-800 text-sm font-mono">
                    {data.patient_name_masked}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {data.patient_gender}, {data.patient_age_years} Yrs
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">
                    Diagnostic Investigation
                  </span>
                  <span className="font-semibold text-slate-800 text-sm block">
                    {data.test_name}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{data.test_code}</span>
                </div>
              </div>

              {/* Report Reference & Version */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-5 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Report Reference</span>
                  <span className="font-mono font-bold text-teal-700 text-sm">
                    {data.report_id_display}
                  </span>
                  <span className="text-slate-500 block">Version {data.version_number}.0</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Validation Status</span>
                  <div className="mt-1">
                    <Badge variant="final" dot>
                      {data.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Cryptographic Security Details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Tamper-Proof HMAC Security Stamp</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200 break-all">
                  SHA256: {data.hmac_digest_truncated}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Validated at: {new Date(data.verified_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center leading-relaxed">
                Notice: This public verification service verifies the tamper-proof authenticity and official finalization of diagnostic reports generated on the DiagnoLab platform.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          Powered by <span className="font-semibold text-slate-600">DiagnoLab Healthcare OS</span> • Strict HIPAA &amp; ISO 15189 Multi-Tenant Security
        </div>
      </div>
    </div>
  );
};
