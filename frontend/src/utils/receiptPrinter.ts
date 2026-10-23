import { Booking, Patient } from '@/types';
import { InvoiceResponse } from '@/types/invoice';

export interface ReceiptItem {
  name: string;
  type?: string;
  price: number;
}

export interface ReceiptPrintData {
  labName?: string;
  labAddress?: string;
  labPhone?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  bookingNumber?: string;
  dateStr?: string;
  patientName?: string;
  patientId?: string;
  gender?: string;
  age?: number | string;
  phone?: string;
  referringDoctor?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod?: string;
}

export function printReceiptOnly(data: ReceiptPrintData): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${data.receiptNumber || data.invoiceNumber || 'TrustMyLab'}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
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
      color: #1e293b;
      margin: 0;
      padding: 16px;
      font-size: 13px;
      line-height: 1.4;
      background: #ffffff;
    }
    .receipt-container {
      max-width: 680px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 24px;
      box-sizing: border-box;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .lab-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f766e;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .lab-meta {
      font-size: 11px;
      color: #64748b;
      margin: 1px 0;
    }
    .badge-box {
      text-align: right;
    }
    .receipt-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .receipt-id {
      font-size: 15px;
      font-family: monospace;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .receipt-date {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .patient-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .patient-row {
      margin: 2px 0;
    }
    .label {
      color: #64748b;
      font-weight: 600;
      display: inline-block;
      width: 100px;
    }
    .val {
      color: #0f172a;
      font-weight: 600;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 12px;
    }
    table.items-table th {
      background: #0f766e;
      color: #ffffff;
      padding: 7px 10px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table.items-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    table.items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .totals-box {
      width: 280px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      padding: 8px 12px;
      font-size: 12px;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    .tot-row.grand {
      border-top: 1px solid #cbd5e1;
      margin-top: 4px;
      padding-top: 6px;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    .tot-row.paid {
      color: #0f766e;
      font-weight: 700;
    }
    .tot-row.balance {
      color: #e11d48;
      font-weight: 700;
    }
    .footer {
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11px;
      color: #64748b;
    }
    .sign-area {
      text-align: right;
    }
    .sign-line {
      width: 140px;
      border-top: 1px solid #94a3b8;
      margin-top: 36px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div>
        <h1 class="lab-title">${data.labName || 'TrustMyLab Diagnostics'}</h1>
        <p class="lab-meta">${data.labAddress || 'Accredited Pathology & Diagnostic Healthcare Center'}</p>
        ${data.labPhone ? `<p class="lab-meta">Phone: ${data.labPhone}</p>` : ''}
      </div>
      <div class="badge-box">
        <div class="receipt-title">Payment Receipt / Bill</div>
        <div class="receipt-id">#${data.receiptNumber || data.invoiceNumber || 'REC'}</div>
        <div class="receipt-date">${data.dateStr || new Date().toLocaleString()}</div>
      </div>
    </div>

    <div class="patient-card">
      <div>
        <div class="patient-row"><span class="label">Patient Name:</span> <span class="val">${data.patientName || 'N/A'}</span></div>
        <div class="patient-row"><span class="label">Patient ID:</span> <span class="val">${data.patientId || 'N/A'}</span></div>
        <div class="patient-row"><span class="label">Gender / Age:</span> <span class="val">${data.gender || '—'} / ${data.age ? data.age + 'y' : '—'}</span></div>
      </div>
      <div>
        <div class="patient-row"><span class="label">Phone:</span> <span class="val">${data.phone || 'N/A'}</span></div>
        <div class="patient-row"><span class="label">Booking Ref:</span> <span class="val">${data.bookingNumber || 'N/A'}</span></div>
        <div class="patient-row"><span class="label">Ref. Doctor:</span> <span class="val">${data.referringDoctor || 'Self / Walk-in'}</span></div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th>Test / Investigation Description</th>
          <th style="width: 80px;">Type</th>
          <th class="text-right" style="width: 90px;">Price (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.length > 0 ? data.items.map((it, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${it.name}</strong></td>
            <td><span style="font-size: 10px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px;">${it.type || 'TEST'}</span></td>
            <td class="text-right">₹${Number(it.price).toFixed(2)}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="4" style="text-align: center; color: #64748b;">Diagnostic investigation services rendered</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="totals-wrapper">
      <div class="totals-box">
        <div class="tot-row"><span>Subtotal:</span> <span>₹${Number(data.subtotal).toFixed(2)}</span></div>
        ${data.discount > 0 ? `<div class="tot-row" style="color: #0f766e;"><span>Discount:</span> <span>-₹${Number(data.discount).toFixed(2)}</span></div>` : ''}
        ${data.tax > 0 ? `<div class="tot-row"><span>Tax:</span> <span>₹${Number(data.tax).toFixed(2)}</span></div>` : ''}
        <div class="tot-row grand"><span>Grand Total:</span> <span>₹${Number(data.grandTotal).toFixed(2)}</span></div>
        <div class="tot-row paid"><span>Amount Paid (${data.paymentMethod || 'CASH'}):</span> <span>₹${Number(data.paidAmount).toFixed(2)}</span></div>
        <div class="tot-row balance"><span>Balance Due:</span> <span>₹${Number(data.balanceAmount).toFixed(2)}</span></div>
      </div>
    </div>

    <div class="footer">
      <div>
        <p style="margin: 0;"><i>Official computer-generated receipt issued by TrustMyLab Healthcare.</i></p>
        <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 10px;">Retain this receipt for insurance claims and specimen tracking.</p>
      </div>
      <div class="sign-area">
        <div class="sign-line"></div>
        <span>Authorized Cashier / Desk Sign</span>
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

    // Trigger print in the iframe
    iframe.contentWindow?.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Error invoking print:', e);
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);
    }, 200);
  }
}

export function formatIndianDateTime(val?: string | Date | null): string {
  if (!val) {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  const str = typeof val === 'string' ? val : val.toISOString();
  const normalized = str.includes('T') && !str.endsWith('Z') && !str.includes('+') ? str + 'Z' : str;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function printReceiptFromBooking(
  booking: Booking,
  patient?: Patient | null,
  paymentMethod: string = 'CASH',
  labName?: string | null
): void {
  const items: ReceiptItem[] = (booking.items || []).map((it) => ({
    name: it.item_name,
    type: it.item_type,
    price: Number(it.final_price ?? it.unit_price),
  }));

  const data: ReceiptPrintData = {
    labName: labName || 'TrustMyLab Diagnostics',
    labAddress: 'Accredited Pathology & Diagnostic Healthcare Center',
    receiptNumber: booking.invoice_id_display || `REC-${booking.booking_id_display}`,
    invoiceNumber: booking.invoice_id_display || undefined,
    bookingNumber: booking.booking_id_display,
    dateStr: formatIndianDateTime(),
    patientName: booking.patient_name || patient?.full_name || 'Patient',
    patientId: booking.patient_id_display || patient?.patient_id_display || 'N/A',
    gender: booking.patient_gender || patient?.gender,
    age: booking.patient_age_years ?? patient?.age_years ?? undefined,
    phone: booking.patient_phone || patient?.phone,
    referringDoctor: booking.referring_doctor || patient?.referring_doctor || 'Self / Walk-in',
    items,
    subtotal: Number(booking.subtotal_amount) || 0,
    discount: Number(booking.discount_amount) || 0,
    tax: Number(booking.tax_amount) || 0,
    grandTotal: Number(booking.grand_total) || 0,
    paidAmount: Number(booking.paid_amount) || 0,
    balanceAmount: Number(booking.balance_amount) || 0,
    paymentMethod,
  };

  printReceiptOnly(data);
}

export function printReceiptFromInvoice(
  inv: InvoiceResponse,
  labName?: string | null,
  booking?: Booking | null
): void {
  const latestPayment = inv.payments && inv.payments.length > 0 ? inv.payments[inv.payments.length - 1] : null;

  const items: ReceiptItem[] =
    booking && booking.items && booking.items.length > 0
      ? booking.items.map((it) => ({
          name: it.item_name,
          type: it.item_type,
          price: Number(it.final_price ?? it.unit_price),
        }))
      : [
          {
            name: `Diagnostic Order Services (${inv.booking_id_display})`,
            type: 'ORDER',
            price: Number(inv.subtotal),
          },
        ];

  const data: ReceiptPrintData = {
    labName: labName || 'TrustMyLab Diagnostics',
    labAddress: 'Accredited Pathology & Diagnostic Healthcare Center',
    receiptNumber: latestPayment?.receipt_id_display || `BILL-${inv.invoice_id_display}`,
    invoiceNumber: inv.invoice_id_display,
    bookingNumber: inv.booking_id_display,
    dateStr: latestPayment ? formatIndianDateTime(latestPayment.created_at) : formatIndianDateTime(inv.invoice_date),
    patientName: inv.patient_name,
    patientId: inv.patient_id_display,
    gender: booking?.patient_gender || undefined,
    age: booking?.patient_age_years ?? undefined,
    phone: booking?.patient_phone || undefined,
    referringDoctor: booking?.referring_doctor || 'Self / Walk-in',
    items,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount_amount),
    tax: Number(inv.tax_amount),
    grandTotal: Number(inv.grand_total),
    paidAmount: Number(inv.paid_amount),
    balanceAmount: Number(inv.balance_amount),
    paymentMethod: latestPayment?.payment_method || 'CASH',
  };

  printReceiptOnly(data);
}

