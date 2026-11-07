import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Badge, toast, confirmDialog } from '@/components/ui';
import { reportService } from '@/api/reportService';
import { ReportDetail } from '@/types';
import {
  Download,
  FileCheck2,
  Lock,
  History,
  ExternalLink,
  ShieldCheck,
  FileImage,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { ReportAmendModal } from './ReportAmendModal';
import { PrintReportModal } from './PrintReportModal';
import { formatResultValue, formatDate } from '@/utils/formatters';

function inferSubgroup(paramName: string, paramCode: string = ''): string | null {
  const nameUpper = (paramName || '').toUpperCase();
  const codeUpper = (paramCode || '').toUpperCase();

  if (
    codeUpper === 'HB' ||
    codeUpper === 'WBC' ||
    nameUpper.includes('HEMOGLOBIN') ||
    nameUpper.includes('HAEMOGLOBIN') ||
    nameUpper.includes('TOTAL LEUCOCYTE') ||
    nameUpper.includes('TOTAL LEUKOCYTE')
  ) {
    return null;
  }
  if (
    ['NEUTROPHIL', 'LYMPHOCYTE', 'MONOCYTE', 'EOSINOPHIL', 'BASOPHIL', 'BAND CELL', 'POLYMORPH'].some((k) =>
      nameUpper.includes(k)
    ) ||
    ['NEUT', 'LYMPH', 'MONO', 'EOS', 'BASO'].includes(codeUpper)
  ) {
    return 'DIFFERENTIAL COUNT :';
  }
  if (
    ['RBC COUNT', 'RBCS COUNT', 'PACKED CELL VOLUME', 'PCV', 'MCV', 'MCH', 'MCHC', 'RDW'].some((k) =>
      nameUpper.includes(k)
    ) ||
    ['RBC', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDW_CV', 'RDW_SD', 'RDW'].includes(codeUpper)
  ) {
    return 'RBCs Indices';
  }
  if (
    ['PLATELET', 'MPV', 'PDW', 'PCT'].some((k) => nameUpper.includes(k)) ||
    ['PLT', 'MPV', 'PDW', 'PCT'].includes(codeUpper)
  ) {
    return 'Platelet Indices';
  }
  return null;
}

function getDefaultInterpretation(testCode?: string, testName?: string): string | null {
  const code = (testCode || '').toUpperCase();
  const name = (testName || '').toUpperCase();

  if (code === 'CBC' || name.includes('COMPLETE BLOOD COUNT')) {
    return 'Hemoglobin/platelet/leucocyte count and platelets count are stable till 24 hrs. The cell morphology is well preserved for 48 hrs. However, haematocrit & MCV variation is observed (MCV -3.5 - 7.5% and HCT - 0.4 - 4.0% leading to a decrease in MCHC). A fresh smear is recommended for an accurate differential WBC count and interpretation of RBC morphology.';
  }
  if (code.includes('LFT') || name.includes('LIVER FUNCTION')) {
    return 'Bilirubin is a break down product of hemoglobin. Bilirubin formed in the reticulo-endothelial system is transport to the liver bound to a albumin. This bilirubin is water insoluble and is know as indirect or unconjugated bilirubin. In the liver, bilirubin is conjugated to glucuronic acid to form direct bilirubin. Conjugated bilirubin is excreted via the bilary system into the intestine where it is metabolized by bacteria to urobilinogen & stercobilinogen.\n\nIncrease:\nTotal bilirubin is elevated in obstructive condition of the bile duct, hepatitis, cirrhosis, in hemolytic disorders and several inherited enzyme deficiencies. Indirect bilirubin is elevated by pre-hepatic causes such as hemolytic disorder or liver disease resulting in impaired entry, transport or conjugated within the liver.';
  }
  if (code.includes('KFT') || name.includes('KIDNEY FUNCTION') || name.includes('RENAL FUNCTION')) {
    return 'Urea is the major end product of protein nitrogen metabolism. It is synthesized by the urea cycle in the liver from ammonia. Creatinine is the catabolic product of creatinine phosphate in muscle. Elevated blood urea and creatinine levels are sensitive indicators of impaired renal function, prerenal azotemia, or urinary tract obstruction.';
  }
  if (code.includes('LIPID')) {
    return 'Lipid profile evaluation is vital for assessing cardiovascular disease (CVD) and atherosclerosis risks. Elevated levels of Total Cholesterol, Triglycerides, and LDL-C are correlated with increased risk of coronary artery disease, whereas elevated HDL-C confers cardioprotective benefits.';
  }
  if (code.includes('THYROID') || code.includes('TFT')) {
    return 'Thyroid stimulating hormone (TSH) is secreted by the anterior pituitary gland and controls the synthesis and release of T3 and T4 from the thyroid gland. Measurement of T3, T4, and TSH is essential in diagnosing hyperthyroidism, primary hypothyroidism, and subclinical thyroid dysfunctions.';
  }
  if (code.includes('WIDAL')) {
    return 'The Widal test detects agglutinating antibodies against Salmonella enterica serotypes Typhi and Paratyphi (O and H antigens). A titre of 1:80 or greater for O antigen and 1:160 or greater for H antigen is clinically suggestive of enteric fever, depending upon endemic baseline levels and clinical correlation.';
  }
  if (code.includes('VDRL') || code.includes('RPR')) {
    return 'VDRL (Venereal Disease Research Laboratory) test is a non-treponemal flocculation test used for screening syphilis. Reactive specimens should be titered and confirmed with specific treponemal tests (e.g. TPHA / FTA-ABS) and correlated clinically.';
  }
  if (code.includes('RBS') || name.includes('RANDOM BLOOD SUGAR') || name.includes('GLUCOSE RANDOM')) {
    return 'Blood glucose measurement is essential in diagnosing and monitoring diabetes mellitus, prediabetes, and hypoglycemia. Random blood sugar >= 200 mg/dL accompanied by classic symptoms (polyuria, polydipsia, weight loss) is diagnostic for diabetes.';
  }
  if (['HIV', 'HBSAG', 'HCV', 'VIRAL'].some((k) => code.includes(k) || name.includes(k))) {
    return 'Screening for transfusion-transmissible viral infections. Non-reactive results indicate absence of detectable antibodies/antigens at the time of testing. A reactive result requires repeat testing and confirmation by standard supplementary assays.';
  }
  return null;
}

export interface ReportDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reportId: string | null;
}

export const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reportId,
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Amend Modal State
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && reportId) {
      loadReport(reportId);
    } else {
      setReport(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, reportId]);

  const loadReport = async (id: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await reportService.getReportDetail(id);
      setReport(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load report details.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!reportId) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await reportService.approveReport(reportId);
      setReport(updated);
      toast.success('Medical report approved by pathologist.');
      setSuccessMessage('Medical report approved by pathologist.');
      onSuccess();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj.response?.data?.message || 'Failed to approve report.';
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!reportId) return;

    const confirmed = await confirmDialog({
      title: 'Finalize & Seal Diagnostic Report',
      message: `Are you sure you want to finalize report ${report?.report_id_display || ''}? This locks all findings, generates the cryptographic HMAC stamp, and makes this report official. Future changes will require a formal amendment.`,
      confirmText: 'Seal & Finalize Report',
      variant: 'primary',
    });
    if (!confirmed) return;

    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await reportService.finalizeReport(reportId);
      setReport(updated);
      toast.success(`Report ${report?.report_id_display || ''} sealed and cryptographically verified!`);
      setSuccessMessage('Report sealed! Cryptographic HMAC generated & PDF created.');
      onSuccess();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj.response?.data?.message || 'Failed to finalize report.';
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!report) return;
    try {
      await reportService.downloadReportPdf(
        report.id,
        `${report.report_id_display}_v${report.current_version}.pdf`
      );
      toast.success('Medical report PDF downloaded successfully.');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj.response?.data?.message || 'Failed to download report PDF.';
      toast.error(msg);
      setErrorMessage(msg);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Diagnostic Medical Report: ${report?.report_id_display || 'Loading...'}`}
        maxWidth="5xl"
      >
        {loading ? (
          <div className="py-12 flex justify-center items-center text-slate-500">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading authentic medical report records...
          </div>
        ) : (
          <div className="space-y-6">
            {errorMessage && <Alert type="error">{errorMessage}</Alert>}
            {successMessage && <Alert type="success">{successMessage}</Alert>}

            {report && (
              <>
                {/* Header Demographics */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Patient</span>
                    <span className="font-semibold text-slate-800 text-sm">{report.patient_name}</span>
                    <span className="text-slate-400 block font-mono text-[11px]">{report.patient_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Demographics</span>
                    <span className="font-semibold text-slate-800">
                      {report.patient_gender}, {report.patient_age_years} Yrs
                    </span>
                    <span className="text-slate-400 block">Ref: {report.booking_id_display}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Test &amp; Version</span>
                    <span className="font-semibold text-slate-800">{report.test_name}</span>
                    <span className="text-teal-700 block font-semibold">Version {report.current_version}.0</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Status</span>
                    <Badge variant={report.status === 'FINAL' ? 'final' : report.status === 'APPROVED' ? 'teal' : report.status === 'PENDING_REVIEW' ? 'pending' : 'slate'}>
                      {report.status}
                    </Badge>
                    {report.is_immutable && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Sealed &amp; Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Pathology Analytes Report View (Uttam Diagnostic Center format: Group, Subgroup, clean unbordered columns) */}
                {report.result_values.length > 0 && (() => {
                  const groupName = (report.result_values.find((v) => v.group_name)?.group_name || 'HAEMATOLOGY').toUpperCase();
                  const testTitle = (report.test_name || 'COMPLETE BLOOD COUNT').toUpperCase();

                  const directParams: typeof report.result_values = [];
                  const subgroupMap: Record<string, typeof report.result_values> = {};

                  for (const v of report.result_values) {
                    const sg = v.subgroup_name || inferSubgroup(v.parameter_name, v.parameter_code);
                    if (!sg) {
                      directParams.push(v);
                    } else {
                      if (!subgroupMap[sg]) subgroupMap[sg] = [];
                      subgroupMap[sg].push(v);
                    }
                  }

                  const interpText = report.interpretation || getDefaultInterpretation(report.test_code, testTitle);

                  return (
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 text-xs font-sans shadow-sm">
                      {/* Demographics Strip */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 text-slate-800 text-[11px] leading-relaxed">
                        <div>
                          <div>
                            <span className="font-bold">Name Of Patient</span> &nbsp;: &nbsp;{report.patient_name}
                          </div>
                          <div>
                            <span className="font-bold">Age / Gender</span> &nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;{report.patient_age_years} Yrs / {report.patient_gender}
                          </div>
                          <div>
                            <span className="font-bold">Referred By</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;
                            {(report as any).booking?.referred_by || (report as any).referred_by || 'DR. SELF'}
                          </div>
                        </div>
                        <div>
                          <div>
                            <span className="font-bold">Test Request ID</span> &nbsp;: &nbsp;
                            {(report as any).booking_id_display || (report as any).booking?.booking_id_display || report.report_id_display}
                          </div>
                          <div>
                            <span className="font-bold">Received Date</span> &nbsp;&nbsp;&nbsp;: &nbsp;
                            {formatDate(report.created_at)}
                          </div>
                          <div>
                            <span className="font-bold">Reporting Date</span> &nbsp;&nbsp;: &nbsp;
                            {formatDate(report.finalized_at)}
                          </div>
                        </div>
                      </div>

                      {/* Column Header with 2 black lines */}
                      <div className="border-t-2 border-b-2 border-slate-900 py-1.5 grid grid-cols-12 font-bold text-slate-900 text-xs">
                        <div className="col-span-5">Test Description</div>
                        <div className="col-span-2 text-center">Observe Value</div>
                        <div className="col-span-2 text-center">Units</div>
                        <div className="col-span-3 text-right">Biological Reference Range</div>
                      </div>

                      {/* Centered Group Name */}
                      <div className="text-center font-bold text-slate-900 tracking-wider text-xs pt-1 pb-0.5">
                        {groupName}
                      </div>

                      {/* Left Underlined Test Title */}
                      <div className="font-bold text-slate-900 underline text-xs pb-1">
                        {testTitle}
                      </div>

                      {/* Direct Parameters */}
                      {directParams.map((v) => {
                        const valStr = formatResultValue(v.numeric_value, v.text_value);
                        const isAbnormal = ['HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW', 'ABNORMAL'].includes(v.flag);
                        return (
                          <div key={v.parameter_id} className="grid grid-cols-12 py-0.5 text-xs text-slate-800">
                            <div className="col-span-5">{v.parameter_name}</div>
                            <div className={`col-span-2 text-center ${isAbnormal ? 'font-bold text-rose-600' : ''}`}>
                              {valStr}
                            </div>
                            <div className="col-span-2 text-center text-slate-600">{v.unit || '—'}</div>
                            <div className="col-span-3 text-right text-slate-600 font-mono text-[11px]">
                              {v.reference_range_display || '—'}
                            </div>
                          </div>
                        );
                      })}

                      {/* Subgroups */}
                      {Object.entries(subgroupMap).map(([sgTitle, params]) => (
                        <div key={sgTitle} className="pt-2">
                          <div className="font-bold text-slate-900 underline text-xs pb-1">
                            {sgTitle}
                          </div>
                          {params.map((v) => {
                            const valStr = formatResultValue(v.numeric_value, v.text_value);
                            const isAbnormal = ['HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW', 'ABNORMAL'].includes(v.flag);
                            return (
                              <div key={v.parameter_id} className="grid grid-cols-12 py-0.5 text-xs text-slate-800">
                                <div className="col-span-5 pl-3">{v.parameter_name}</div>
                                <div className={`col-span-2 text-center ${isAbnormal ? 'font-bold text-rose-600' : ''}`}>
                                  {valStr}
                                </div>
                                <div className="col-span-2 text-center text-slate-600">{v.unit || '—'}</div>
                                <div className="col-span-3 text-right text-slate-600 font-mono text-[11px]">
                                  {v.reference_range_display || '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {/* Interpretation */}
                      {interpText && (
                        <div className="pt-3 border-t border-slate-100">
                          <div className="font-bold text-slate-900 underline text-xs pb-1">
                            INTERPRETATION :
                          </div>
                          <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">
                            {interpText}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Radiology Narrative Section */}
                {(report.imaging_findings || report.clinical_history || report.imaging_impression) && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    {/* One-box consolidated findings */}
                    {report.imaging_findings && !report.clinical_history && !report.imaging_impression ? (
                      <div>
                        <span className="font-bold text-slate-700 block uppercase tracking-wider mb-2">
                          Radiological Report &amp; Findings:
                        </span>
                        {/<[a-z][\s\S]*>/i.test(report.imaging_findings) ? (
                          <div
                            className="bg-white p-3.5 rounded-lg border border-slate-200 text-slate-800 leading-relaxed font-sans text-xs [&_b]:font-bold [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mt-2 [&_h4]:font-bold [&_ul]:list-disc [&_ul]:pl-4"
                            dangerouslySetInnerHTML={{ __html: report.imaging_findings }}
                          />
                        ) : (
                          <pre className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                            {report.imaging_findings}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <>
                        {report.clinical_history && (
                          <div>
                            <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                              Clinical History:
                            </span>
                            <p className="text-slate-600 font-sans">{report.clinical_history}</p>
                          </div>
                        )}
                        {report.imaging_findings && (
                          <div>
                            <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                              Imaging Findings:
                            </span>
                            {/<[a-z][\s\S]*>/i.test(report.imaging_findings) ? (
                              <div
                                className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 leading-relaxed font-sans text-xs [&_b]:font-bold"
                                dangerouslySetInnerHTML={{ __html: report.imaging_findings }}
                              />
                            ) : (
                              <pre className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                                {report.imaging_findings}
                              </pre>
                            )}
                          </div>
                        )}
                        {report.imaging_impression && (
                          <div>
                            <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                              Impression:
                            </span>
                            <p className="text-slate-900 font-semibold">{report.imaging_impression}</p>
                          </div>
                        )}
                        {report.recommendations && (
                          <div>
                            <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                              Recommendations:
                            </span>
                            <p className="text-slate-600">{report.recommendations}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {report.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileImage className="w-4 h-4 text-teal-600" />
                      Diagnostic Scan Attachments ({report.attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {report.attachments.map((att) => (
                        <div key={att.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5">
                          <FileImage className="w-5 h-5 text-teal-600 shrink-0" />
                          <div className="truncate">
                            <span className="font-medium text-slate-800 block truncate">{att.file_name}</span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {(att.file_size_bytes / 1024).toFixed(1)} KB • {att.caption || 'No caption'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Digital Signature & Approver Card */}
                {report.approved_by_name && (
                  <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-teal-900 block">
                          Digitally Authenticated by {report.approved_by_name}
                        </span>
                        <span className="text-teal-700 font-mono text-[10px]">
                          HMAC Digest: {report.hmac_digest ? `${report.hmac_digest.slice(0, 16)}...${report.hmac_digest.slice(-8)}` : 'Generating...'}
                        </span>
                      </div>
                    </div>
                    {report.verification_token && (
                      <a
                        href={`/verify/${report.verification_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-teal-200 shadow-sm transition-colors"
                      >
                        <span>Verify QR</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Version History */}
                {report.versions.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-500" />
                      Prior Report Versions ({report.versions.length})
                    </h3>
                    <div className="space-y-1.5">
                      {report.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              Version {ver.version_number}.0 Snapshot
                            </span>
                            <span className="text-slate-400 ml-2 font-mono text-[10px]">
                              {new Date(ver.created_at).toLocaleDateString()} by {ver.amended_by_name || 'Staff'}
                            </span>
                            <p className="text-slate-600 mt-0.5 text-[11px] italic">
                              &ldquo;{ver.amendment_reason}&rdquo;
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-between items-center pt-4 border-t border-slate-100 gap-2">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve Action */}
                    {(report.status === 'PENDING_REVIEW' || report.status === 'DRAFT' || report.status === 'REVIEWED') && (
                      <Button
                        variant="secondary"
                        onClick={handleApprove}
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5 text-teal-700 border-teal-300 hover:bg-teal-50"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>{isActionLoading ? 'Signing...' : 'Approve & Sign Off'}</span>
                      </Button>
                    )}

                    {/* Finalize Action */}
                    {(report.status === 'APPROVED' || report.status === 'PENDING_REVIEW' || report.status === 'DRAFT' || report.status === 'REVIEWED') && (
                      <Button
                        variant="primary"
                        onClick={handleFinalize}
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5"
                      >
                        <Lock className="w-4 h-4" />
                        <span>{isActionLoading ? 'Sealing PDF...' : 'Finalize & Generate PDF'}</span>
                      </Button>
                    )}

                    {/* Download & Print Actions */}
                    {report.status === 'FINAL' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => setIsAmendModalOpen(true)}
                          className="flex items-center gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Amend Report</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleDownload}
                          className="flex items-center gap-1.5 text-slate-700"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download PDF</span>
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => setIsPrintModalOpen(true)}
                          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                          title="Print report on pre-printed letterhead or plain paper"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print Report</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Versioned Amendment Modal */}
      {report && (
        <ReportAmendModal
          isOpen={isAmendModalOpen}
          onClose={() => setIsAmendModalOpen(false)}
          onSuccess={() => {
            setIsAmendModalOpen(false);
            loadReport(report.id);
            onSuccess();
          }}
          reportId={report.id}
          reportDisplayId={report.report_id_display}
          currentVersion={report.current_version}
        />
      )}
      {/* Print Modal */}
      {report && (
        <PrintReportModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          reportId={report.id}
          reportDisplayId={report.report_id_display}
          patientName={report.patient_name}
          testName={report.test_name}
        />
      )}
    </>
  );
};
