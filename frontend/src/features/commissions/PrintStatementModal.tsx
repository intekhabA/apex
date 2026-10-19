import React, { useState } from 'react';
import { Modal, Button } from '@/components/ui';
import { DoctorCommissionReport } from '@/types/doctor';
import { Printer, Users, Receipt, FileText } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: DoctorCommissionReport | null;
  labName?: string;
  defaultMode?: 'ledger' | 'tests' | 'complete';
}

/**
 * Robust standalone iframe printer for Doctor Commission & Referral Ledger.
 * Solves the issue where printing from within an overflow/fixed modal window in Chrome
 * clips multi-page content or only shows the top summary card.
 */
function printCommissionStatementIframe(options: {
  labName: string;
  report: DoctorCommissionReport;
  statementType: 'ledger' | 'tests' | 'complete';
}) {
  const { labName, report, statementType } = options;

  const totalIncome = Number(report.total_income) || 0;
  const totalCommission = Number(report.total_commission) || 0;
  const effectivePct = Number(report.effective_percentage) || 0;
  const patientCountSum = report.total_patients || 0;
  const testsCountSum = report.total_tests || 0;

  const printDateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const ledgerRowsHtml = (report.patient_ledger || [])
    .map((item, idx) => {
      const price = Number(item.test_price) || 0;
      const comm = Number(item.commission_amount) || 0;
      const pct = Number(item.commission_percentage) || 0;
      const bgClass = idx % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';

      return `
        <tr style="${bgClass}">
          <td style="text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
          <td>
            <div style="font-weight: 600; font-family: monospace; font-size: 11px;">${item.booking_id_display}</div>
            <div style="font-size: 10px; color: #64748b;">${item.booking_date}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${item.patient_name}</div>
            ${item.patient_mrn ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">MRN: ${item.patient_mrn}</div>` : ''}
          </td>
          ${!report.doctor_filter ? `<td style="color: #334155; font-weight: 500;">${item.doctor_name}</td>` : ''}
          <td style="font-weight: 500; color: #1e293b;">${item.test_name}</td>
          <td style="text-align: right; font-weight: 600; color: #0f172a;">₹${price.toFixed(2)}</td>
          <td style="text-align: center; font-weight: 700; color: #334155;">${pct.toFixed(1)}%</td>
          <td style="text-align: right; font-weight: 700; color: #047857;">₹${comm.toFixed(2)}</td>
          <td style="text-align: center; font-size: 10px; font-weight: 700; color: ${item.payment_status === 'PAID' ? '#047857' : '#b45309'};">
            ${item.payment_status}
          </td>
        </tr>
      `;
    })
    .join('');

  const testBreakdownRowsHtml = (report.test_breakdown || [])
    .map((t, idx) => {
      const gross = Number(t.total_income) || 0;
      const comm = Number(t.commission_amount) || 0;
      const pct = Number(t.commission_percentage) || 0;
      const bgClass = t.is_custom_percentage
        ? 'background-color: #fef3c7;'
        : idx % 2 === 1
        ? 'background-color: #f8fafc;'
        : 'background-color: #ffffff;';

      return `
        <tr style="${bgClass}">
          <td style="font-weight: 600; color: #0f172a;">
            ${t.test_name}
            ${t.is_custom_percentage ? '<span style="margin-left: 6px; font-size: 9px; font-weight: 800; background: #fde68a; color: #92400e; padding: 1px 4px; border-radius: 4px;">CUSTOM RATE</span>' : ''}
          </td>
          <td style="text-align: center; font-weight: 600; color: #334155;">${t.tests_count}</td>
          <td style="text-align: right; font-weight: 600; color: #0f172a;">₹${gross.toFixed(2)}</td>
          <td style="text-align: center; font-weight: 700; color: #0f172a;">${pct.toFixed(1)}%</td>
          <td style="text-align: right; font-weight: 700; color: #047857;">₹${comm.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  const showLedger = statementType === 'ledger' || statementType === 'complete';
  const showTests = statementType === 'tests' || statementType === 'complete';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${labName} - Doctor Commission Statement</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 10px;
      font-size: 12px;
      line-height: 1.4;
      background: #ffffff;
    }
    .statement-container {
      width: 100%;
      box-sizing: border-box;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .lab-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .statement-title {
      font-size: 13px;
      font-weight: 800;
      color: #0d9488;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-meta {
      font-size: 11px;
      color: #334155;
      text-align: right;
    }
    .summary-card {
      display: flex;
      justify-content: space-between;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      box-sizing: border-box;
    }
    .summary-doctor {
      flex: 1;
    }
    .summary-doctor-title {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .summary-doctor-name {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .summary-pill {
      display: inline-block;
      padding: 2px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      margin-right: 6px;
    }
    .summary-pill-gray {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
    }
    .summary-totals {
      text-align: right;
      padding-left: 16px;
      border-left: 1px solid #e2e8f0;
    }
    .summary-totals-title {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .summary-commission-sum {
      font-size: 22px;
      font-weight: 900;
      color: #047857;
      margin: 0 0 2px 0;
    }
    .summary-billed-sum {
      font-size: 11px;
      color: #475569;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin: 14px 0 6px 0;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }
    thead {
      display: table-header-group;
    }
    th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      text-align: left;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr {
      page-break-inside: avoid;
    }
    tfoot tr td {
      background-color: #f1f5f9;
      font-weight: 800;
      border: 1px solid #cbd5e1;
      padding: 7px 8px;
      color: #0f172a;
    }
    .signatures-block {
      margin-top: 32px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-col {
      width: 28%;
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #475569;
      margin-top: 40px;
      padding-top: 4px;
      font-weight: 700;
      font-size: 11px;
      color: #1e293b;
    }
    .sig-role {
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="statement-container">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="lab-title">${labName}</div>
        <div class="statement-title">Doctor Referral Commission & Patient Ledger</div>
        <div style="font-size: 10px; color: #64748b;">Official Diagnostic Commission Statement & Payout Voucher</div>
      </div>
      <div class="header-meta">
        <div>Statement Period: <strong>${report.start_date} to ${report.end_date}</strong></div>
        <div>Billing Cycle: <strong style="text-transform: uppercase;">${report.period_type}</strong></div>
        <div>Generated: ${printDateStr}</div>
      </div>
    </div>

    <!-- Doctor & Highlights Card with Sums -->
    <div class="summary-card">
      <div class="summary-doctor">
        <div class="summary-doctor-title">Referring Doctor</div>
        <div class="summary-doctor-name">${report.doctor_filter || 'All Referring Doctors (Consolidated)'}</div>
        <div style="margin-top: 6px;">
          <span class="summary-pill">Total Patients: ${patientCountSum}</span>
          <span class="summary-pill-gray">Tests Referred: ${testsCountSum}</span>
        </div>
      </div>

      <div class="summary-totals">
        <div class="summary-totals-title">Total Commission Payable</div>
        <div class="summary-commission-sum">₹${totalCommission.toFixed(2)}</div>
        <div class="summary-billed-sum">
          Total Billed Gross: <strong>₹${totalIncome.toFixed(2)}</strong> | Avg Comm Rate: <strong>${effectivePct.toFixed(1)}%</strong>
        </div>
      </div>
    </div>

    ${
      showLedger
        ? `
      <div class="section-title">Itemized Patient Referral Ledger (${report.patient_ledger?.length || 0} Records)</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 110px;">Date & Booking</th>
            <th>Patient Details</th>
            ${!report.doctor_filter ? '<th>Referring Doctor</th>' : ''}
            <th>Referred Test</th>
            <th style="width: 90px; text-align: right;">Billed (₹)</th>
            <th style="width: 70px; text-align: center;">Comm %</th>
            <th style="width: 100px; text-align: right;">Commission (₹)</th>
            <th style="width: 60px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            report.patient_ledger && report.patient_ledger.length > 0
              ? ledgerRowsHtml
              : `<tr><td colspan="${report.doctor_filter ? 8 : 9}" style="text-align: center; color: #94a3b8; padding: 16px;">No referral records found for this period.</td></tr>`
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="${report.doctor_filter ? 4 : 5}">
              Grand Total: <span style="color: #0369a1; font-weight: 900;">${patientCountSum} Total Patients</span> (${testsCountSum} Tests)
            </td>
            <td style="text-align: right; font-weight: 900;">₹${totalIncome.toFixed(2)}</td>
            <td style="text-align: center; font-weight: 800; color: #0d9488;">${effectivePct.toFixed(1)}%</td>
            <td style="text-align: right; font-weight: 900; color: #047857; font-size: 13px;">₹${totalCommission.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `
        : ''
    }

    ${
      showTests
        ? `
      <div class="section-title">Test-Wise Summary Breakdown (${report.test_breakdown?.length || 0} Test Groups)</div>
      <table>
        <thead>
          <tr>
            <th>Test Name & Rate Status</th>
            <th style="width: 100px; text-align: center;">Tests Count</th>
            <th style="width: 120px; text-align: right;">Gross Billed (₹)</th>
            <th style="width: 100px; text-align: center;">Commission %</th>
            <th style="width: 130px; text-align: right;">Commission Earned (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${
            report.test_breakdown && report.test_breakdown.length > 0
              ? testBreakdownRowsHtml
              : `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 16px;">No test summary data recorded.</td></tr>`
          }
        </tbody>
        <tfoot>
          <tr>
            <td>Total (${patientCountSum} Patients)</td>
            <td style="text-align: center; font-weight: 900;">${testsCountSum} tests</td>
            <td style="text-align: right; font-weight: 900;">₹${totalIncome.toFixed(2)}</td>
            <td style="text-align: center; font-weight: 800; color: #0d9488;">${effectivePct.toFixed(1)}% avg</td>
            <td style="text-align: right; font-weight: 900; color: #047857; font-size: 13px;">₹${totalCommission.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    `
        : ''
    }

    <!-- Signatures -->
    <div class="signatures-block">
      <div class="sig-col">
        <div class="sig-line">Prepared By (Accounts)</div>
        <div class="sig-role">Accounts & Billing Department</div>
      </div>
      <div class="sig-col">
        <div class="sig-line">Authorized Signatory (Lab)</div>
        <div class="sig-role">Laboratory Director / Administrator</div>
      </div>
      <div class="sig-col">
        <div class="sig-line">Doctor Acknowledgment</div>
        <div class="sig-role">Signature, Stamp & Date</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Error invoking iframe print:', e);
        // Fallback to window.print() if iframe print is blocked
        window.print();
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 4000);
    }, 250);
  } else {
    window.print();
  }
}

export const PrintStatementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  report,
  labName = 'DiagnoLab Diagnostic Services',
  defaultMode = 'ledger',
}) => {
  const [statementType, setStatementType] = useState<'ledger' | 'tests' | 'complete'>(defaultMode);

  if (!report) return null;

  const handlePrint = () => {
    printCommissionStatementIframe({
      labName,
      report,
      statementType,
    });
  };

  const totalIncome = Number(report.total_income) || 0;
  const totalCommission = Number(report.total_commission) || 0;
  const effectivePct = Number(report.effective_percentage) || 0;
  const patientCountSum = report.total_patients || 0;
  const testsCountSum = report.total_tests || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Doctor Commission Statement & Referral Ledger"
      description="Review and print doctor referral commission statement with patient count and commission totals."
      maxWidth="5xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Statement Period: <strong>{report.start_date} to {report.end_date}</strong></span>
            <span>•</span>
            <span>Mode: <strong className="uppercase">{report.period_type}</strong></span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handlePrint} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700">
              <Printer className="w-4 h-4" />
              <span>Print Statement</span>
            </Button>
          </div>
        </div>
      }
    >
      {/* Screen Mode Selector Tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatementType('ledger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              statementType === 'ledger'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Patient Referral Ledger ({report.patient_ledger?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatementType('tests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              statementType === 'tests'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Test-Wise Summary ({report.test_breakdown?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatementType('complete')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              statementType === 'complete'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Consolidated Statement (Both)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Ready for A4 Landscape Printing
        </div>
      </div>

      {/* On-Screen Preview Container */}
      <div className="p-4 bg-white text-slate-900 space-y-5 border border-slate-200 rounded-xl">
        {/* Document Header */}
        <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{labName}</h1>
            <p className="text-xs font-semibold text-brand-700 mt-0.5 uppercase tracking-wide">
              Doctor Referral Commission & Patient Ledger
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Official Payout Endorsement & Audit Voucher
            </p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p className="font-semibold text-slate-800">
              Period: <span className="font-normal text-slate-700">{report.start_date} to {report.end_date}</span>
            </p>
            <p className="font-semibold text-slate-800">
              Cycle: <span className="font-bold uppercase text-brand-600">{report.period_type}</span>
            </p>
          </div>
        </div>

        {/* Doctor & Prominent Sum Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-300">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Referring Doctor</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">
              {report.doctor_filter || 'All Referring Doctors (Consolidated)'}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-700">
              <span className="inline-flex items-center gap-1 font-semibold bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                <Users className="w-3.5 h-3.5" />
                Total Patients: <strong>{patientCountSum}</strong>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-300">
                Tests Referred: <strong>{testsCountSum}</strong>
              </span>
            </div>
          </div>

          <div className="text-right sm:border-l sm:pl-4 border-slate-200">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Total Commission Payable</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">
              ₹{totalCommission.toFixed(2)}
            </p>
            <p className="text-xs text-slate-600 mt-1.5 font-medium">
              Gross Billed Volume: <strong className="text-slate-900">₹{totalIncome.toFixed(2)}</strong> (Effective Avg: <strong className="text-brand-700">{effectivePct.toFixed(1)}%</strong>)
            </p>
          </div>
        </div>

        {/* SECTION 1: Patient Referral Ledger */}
        {(statementType === 'ledger' || statementType === 'complete') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                <span>Itemized Patient Referral Ledger</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Showing {report.patient_ledger?.length || 0} referral transaction(s)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="min-w-full text-xs text-left divide-y divide-slate-300">
                <thead className="bg-slate-100 font-bold text-slate-800">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">Date & Booking ID</th>
                    <th className="p-2">Patient Name & MRN</th>
                    {!report.doctor_filter && <th className="p-2">Doctor</th>}
                    <th className="p-2">Test Performed</th>
                    <th className="p-2 text-right">Billed (₹)</th>
                    <th className="p-2 text-center">Comm %</th>
                    <th className="p-2 text-right">Commission (₹)</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {!report.patient_ledger || report.patient_ledger.length === 0 ? (
                    <tr>
                      <td colSpan={report.doctor_filter ? 8 : 9} className="p-4 text-center text-slate-400 italic">
                        No referral transactions recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    report.patient_ledger.map((item, idx) => {
                      const price = Number(item.test_price) || 0;
                      const comm = Number(item.commission_amount) || 0;
                      const pct = Number(item.commission_percentage) || 0;

                      return (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="p-2 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="p-2">
                            <div className="font-semibold text-slate-900 font-mono text-[11px]">
                              {item.booking_id_display}
                            </div>
                            <div className="text-[10px] text-slate-500">{item.booking_date}</div>
                          </td>
                          <td className="p-2">
                            <div className="font-bold text-slate-900">{item.patient_name}</div>
                            {item.patient_mrn && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                MRN: {item.patient_mrn}
                              </div>
                            )}
                          </td>
                          {!report.doctor_filter && (
                            <td className="p-2 text-slate-700 font-medium">
                              {item.doctor_name}
                            </td>
                          )}
                          <td className="p-2 font-medium text-slate-800">
                            {item.test_name}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-900">
                            ₹{price.toFixed(2)}
                          </td>
                          <td className="p-2 text-center font-bold text-slate-700">
                            {pct.toFixed(1)}%
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-700">
                            ₹{comm.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                item.payment_status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.payment_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={report.doctor_filter ? 4 : 5} className="p-2 text-left">
                      <span>Grand Total: </span>
                      <span className="text-blue-700 font-black underline ml-1">
                        {patientCountSum} Total Patients
                      </span>
                      <span className="text-slate-500 font-normal ml-2">
                        ({testsCountSum} Tests)
                      </span>
                    </td>
                    <td className="p-2 text-right font-black text-slate-900">
                      ₹{totalIncome.toFixed(2)}
                    </td>
                    <td className="p-2 text-center font-bold text-brand-700">
                      {effectivePct.toFixed(1)}%
                    </td>
                    <td className="p-2 text-right font-black text-emerald-800 text-sm">
                      ₹{totalCommission.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 2: Test-Wise Breakdown */}
        {(statementType === 'tests' || statementType === 'complete') && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-brand-600" />
                <span>Test-Wise Summary Breakdown</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                {report.test_breakdown?.length || 0} test group(s)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="min-w-full text-xs text-left divide-y divide-slate-300">
                <thead className="bg-slate-100 font-bold text-slate-800">
                  <tr>
                    <th className="p-2">Test Name</th>
                    <th className="p-2 text-center">Tests Count</th>
                    <th className="p-2 text-right">Gross Income (₹)</th>
                    <th className="p-2 text-center">Commission %</th>
                    <th className="p-2 text-right">Commission Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {!report.test_breakdown || report.test_breakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                        No test data available for this range.
                      </td>
                    </tr>
                  ) : (
                    report.test_breakdown.map((t, idx) => (
                      <tr key={idx} className={t.is_custom_percentage ? 'bg-amber-50/50' : idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                        <td className="p-2 font-medium text-slate-900">
                          {t.test_name}
                          {t.is_custom_percentage && (
                            <span className="ml-1.5 text-[10px] text-amber-700 font-bold">
                              (Custom Rate)
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center font-semibold text-slate-700">{t.tests_count}</td>
                        <td className="p-2 text-right font-medium text-slate-900">₹{Number(t.total_income).toFixed(2)}</td>
                        <td className="p-2 text-center font-bold text-slate-800">
                          {Number(t.commission_percentage).toFixed(1)}%
                        </td>
                        <td className="p-2 text-right font-bold text-emerald-700">
                          ₹{Number(t.commission_amount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="p-2">
                      Total ({patientCountSum} Patients)
                    </td>
                    <td className="p-2 text-center font-black">{testsCountSum} tests</td>
                    <td className="p-2 text-right font-black">₹{totalIncome.toFixed(2)}</td>
                    <td className="p-2 text-center font-bold text-brand-700">{effectivePct.toFixed(1)}% avg</td>
                    <td className="p-2 text-right font-black text-emerald-800 text-sm">₹{totalCommission.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Footer Signatures */}
        <div className="pt-8 grid grid-cols-3 gap-6 text-xs text-slate-600 border-t-2 border-slate-300">
          <div>
            <p className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">
              Prepared By (Accounts)
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Billing & Accounts Dept.</p>
          </div>
          <div className="text-center">
            <p className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">
              Authorized Signatory (Lab)
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Laboratory Director / Administrator</p>
          </div>
          <div className="text-right">
            <p className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">
              Doctor Acknowledgment
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Signature & Stamp / Date</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
