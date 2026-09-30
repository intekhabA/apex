import React from 'react';
import { Modal, Button } from '@/components/ui';
import { DoctorCommissionReport } from '@/types/doctor';
import { Printer } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: DoctorCommissionReport | null;
  labName?: string;
}

export const PrintStatementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  report,
  labName = 'DiagnoLab Diagnostic Services',
}) => {
  if (!report) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalIncome = Number(report.total_income) || 0;
  const totalCommission = Number(report.total_commission) || 0;
  const effectivePct = Number(report.effective_percentage) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Doctor Commission Payout Voucher"
      description="Review and print the itemized doctor referral commission statement."
      maxWidth="2xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <span className="text-xs text-slate-500">
            Statement Period: {report.start_date} to {report.end_date}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handlePrint} className="flex items-center gap-1.5">
              <Printer className="w-4 h-4" />
              Print Voucher
            </Button>
          </div>
        </div>
      }
    >
      <div id="printable-voucher" className="p-4 bg-white text-slate-900 space-y-6">
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{labName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Doctor Referral & Commission Payout Statement</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold text-slate-800">
              Period: <span className="font-normal text-slate-600">{report.start_date} to {report.end_date}</span>
            </p>
            <p className="font-semibold text-slate-800 mt-1">
              Mode: <span className="font-normal uppercase text-brand-600">{report.period_type}</span>
            </p>
          </div>
        </div>

        {/* Doctor & Summary Box */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="text-xs text-slate-500 font-medium">Referred Doctor:</p>
            <p className="text-base font-bold text-slate-900">
              {report.doctor_filter || 'All Referring Doctors (Consolidated)'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Referred Patient Tests: <span className="font-semibold">{report.total_tests}</span> | Patients: <span className="font-semibold">{report.total_patients}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium">Total Net Commission Payable:</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">
              ₹{totalCommission.toFixed(2)}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Total Billed Volume: ₹{totalIncome.toFixed(2)} (Effective Rate: {effectivePct}%)
            </p>
          </div>
        </div>

        {/* Test-wise Payout Ledger */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Test-Wise Commission Breakdown (Different Percentages Applied)
          </h4>
          <table className="w-full text-xs text-left border border-slate-200 divide-y divide-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 font-semibold text-slate-700">
              <tr>
                <th className="p-2">Test Name</th>
                <th className="p-2 text-center">Tests Count</th>
                <th className="p-2 text-right">Gross Income</th>
                <th className="p-2 text-center">Commission %</th>
                <th className="p-2 text-right">Commission Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.test_breakdown.map((t, idx) => (
                <tr key={idx} className={t.is_custom_percentage ? 'bg-amber-50/50' : ''}>
                  <td className="p-2 font-medium text-slate-900">
                    {t.test_name}
                    {t.is_custom_percentage && (
                      <span className="ml-1.5 text-[10px] text-amber-700 font-semibold">
                        (Custom Rate)
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">{t.tests_count}</td>
                  <td className="p-2 text-right">₹{Number(t.total_income).toFixed(2)}</td>
                  <td className="p-2 text-center font-bold">
                    {Number(t.commission_percentage).toFixed(1)}%
                  </td>
                  <td className="p-2 text-right font-bold text-emerald-700">
                    ₹{Number(t.commission_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <td className="p-2">Total</td>
                <td className="p-2 text-center">{report.total_tests}</td>
                <td className="p-2 text-right">₹{totalIncome.toFixed(2)}</td>
                <td className="p-2 text-center">{effectivePct}% (avg)</td>
                <td className="p-2 text-right text-emerald-800">₹{totalCommission.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Signatures */}
        <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-slate-500 border-t">
          <div>
            <p className="border-t border-slate-300 pt-2 w-48 font-medium text-slate-700">
              Authorized Signature (Lab)
            </p>
          </div>
          <div className="text-right flex justify-end">
            <p className="border-t border-slate-300 pt-2 w-48 font-medium text-slate-700">
              Doctor Signature / Received
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
