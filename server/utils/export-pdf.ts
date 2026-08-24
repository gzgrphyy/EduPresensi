export interface ReportPDFOptions {
  title: string
  subtitle?: string
  dateRange?: string
  schoolName?: string
  schoolAddress?: string
  schoolLogoBase64?: string
  columns: { header: string; widthRatio?: number; align?: 'left' | 'center' | 'right' }[]
  rows: string[][]
  summaryCards?: { label: string; value: string | number; color?: string }[]
  signatures?: { role: string; name: string; nip?: string }[]
}

/**
 * Generate a standalone printable HTML document with auto print dialog or direct view
 * and return as HTML buffer / PDF response
 */
export function generatePrintableHtml(options: ReportPDFOptions): string {
  const {
    title,
    subtitle = '',
    dateRange = '',
    schoolName = 'SMK NEGERI 1 BANDUNG',
    schoolAddress = 'Jl. Wastukancana No. 3, Bandung',
    columns,
    rows,
    summaryCards = [],
    signatures = []
  } = options

  const summaryHtml = summaryCards.length > 0 ? `
    <div class="summary-grid">
      ${summaryCards.map(c => `
        <div class="summary-card" style="border-top: 3px solid ${c.color || '#0A66A0'}">
          <div class="summary-label">${c.label}</div>
          <div class="summary-value" style="color: ${c.color || '#0A66A0'}">${c.value}</div>
        </div>
      `).join('')}
    </div>
  ` : ''

  const tableHeaderHtml = columns.map(c => `
    <th style="text-align: ${c.align || 'left'}; width: ${c.widthRatio ? `${c.widthRatio}%` : 'auto'}">${c.header}</th>
  `).join('')

  const tableRowsHtml = rows.map((row, idx) => `
    <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
      ${row.map((cell, cIdx) => `
        <td style="text-align: ${columns[cIdx]?.align || 'left'}">${cell}</td>
      `).join('')}
    </tr>
  `).join('')

  const signatureHtml = signatures.length > 0 ? `
    <div class="signature-section">
      ${signatures.map(s => `
        <div class="signature-box">
          <p class="sig-role">${s.role}</p>
          <div class="sig-space"></div>
          <p class="sig-name"><u>${s.name}</u></p>
          ${s.nip ? `<p class="sig-nip">NIP. ${s.nip}</p>` : ''}
        </div>
      `).join('')}
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm 1.2cm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      font-size: 11px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header-kop {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px double #334155;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .kop-logo {
      width: 55px;
      height: 55px;
      object-fit: contain;
      background: #0A66A0;
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
    }
    .kop-text h1 {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kop-text p {
      font-size: 10px;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .report-title-box {
      text-align: center;
      margin-bottom: 18px;
    }
    .report-title-box h2 {
      font-size: 14px;
      font-weight: 700;
      margin: 0;
      color: #0A66A0;
      text-transform: uppercase;
    }
    .report-title-box p {
      font-size: 10px;
      color: #64748b;
      margin: 4px 0 0 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }
    .summary-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .summary-value {
      font-size: 14px;
      font-weight: 700;
      margin-top: 2px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    table.data-table th {
      background-color: #0A66A0;
      color: #ffffff;
      font-weight: 700;
      font-size: 10px;
      padding: 7px 8px;
      border: 1px solid #0284c7;
      text-transform: uppercase;
    }
    table.data-table td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10px;
    }
    table.data-table tr.even {
      background-color: #f8fafc;
    }
    .signature-section {
      display: flex;
      justify-content: flex-end;
      gap: 40px;
      margin-top: 30px;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      min-width: 180px;
    }
    .sig-role {
      font-size: 10px;
      margin-bottom: 50px;
    }
    .sig-space {
      height: 10px;
    }
    .sig-name {
      font-size: 11px;
      font-weight: 700;
      margin: 0;
    }
    .sig-nip {
      font-size: 9px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .print-bar {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ffffff;
      padding: 8px 14px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #cbd5e1;
      display: flex;
      gap: 8px;
      z-index: 999;
    }
    .print-btn {
      background: #0A66A0;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
  </div>

  <div class="header-kop">
    <div class="kop-logo">${schoolName.charAt(0)}</div>
    <div class="kop-text">
      <h1>${schoolName}</h1>
      <p>${schoolAddress}</p>
      <p>Sistem Rekapitulasi Presensi Digital Siswa</p>
    </div>
  </div>

  <div class="report-title-box">
    <h2>${title}</h2>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
    ${dateRange ? `<p style="font-weight: 600; color: #334155;">Periode: ${dateRange}</p>` : ''}
  </div>

  ${summaryHtml}

  <table class="data-table">
    <thead>
      <tr>${tableHeaderHtml}</tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  ${signatureHtml}
</body>
</html>`
}
