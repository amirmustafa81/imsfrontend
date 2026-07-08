type PrintValue = string | number | boolean | null | undefined;

type PrintField = {
  label: string;
  value: PrintValue;
};

type PrintColumn<T> = {
  header: string;
  render: (row: T, index: number) => PrintValue;
};

type PrintDocumentOptions<T> = {
  title: string;
  subtitle?: string;
  reference?: PrintValue;
  status?: PrintValue;
  meta?: PrintField[];
  columns: PrintColumn<T>[];
  rows: T[];
  note?: PrintValue;
};

const escapeHtml = (value: PrintValue): string =>
  String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const displayValue = (value: PrintValue): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const toTitle = (value: PrintValue): string => displayValue(value).replaceAll("_", " ");

export const printTransactionDocument = <T,>({
  title,
  subtitle,
  reference,
  status,
  meta = [],
  columns,
  rows,
  note,
}: PrintDocumentOptions<T>): boolean => {
  if (typeof window === "undefined") return false;

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!printWindow) return false;

  const generatedAt = new Date().toLocaleString();
  const metaRows = meta
    .filter((field) => displayValue(field.value) !== "-")
    .map(
      (field) => `
        <div class="meta-item">
          <span>${escapeHtml(field.label)}</span>
          <strong>${escapeHtml(displayValue(field.value))}</strong>
        </div>
      `,
    )
    .join("");

  const tableHead = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const tableBody = rows.length
    ? rows
        .map(
          (row, rowIndex) => `
            <tr>
              ${columns.map((column) => `<td>${escapeHtml(displayValue(column.render(row, rowIndex)))}</td>`).join("")}
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="${columns.length}" class="empty">No item lines found.</td></tr>`;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            margin: 0;
          }
          .header {
            border-bottom: 2px solid #1f4e79;
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 12px;
          }
          .brand {
            color: #1f4e79;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          h1 {
            font-size: 22px;
            margin: 6px 0 4px;
          }
          .subtitle {
            color: #4b5563;
            font-size: 12px;
            margin: 0;
          }
          .header-right {
            min-width: 180px;
            text-align: right;
          }
          .badge {
            background: #e7f5ee;
            border: 1px solid #b8e3cd;
            border-radius: 999px;
            color: #087443;
            display: inline-block;
            font-weight: 700;
            padding: 3px 9px;
            text-transform: capitalize;
          }
          .generated {
            color: #6b7280;
            margin-top: 8px;
          }
          .meta {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px 14px;
            margin: 18px 0;
          }
          .meta-item {
            border: 1px solid #d9e2ec;
            border-radius: 4px;
            padding: 7px 8px;
          }
          .meta-item span {
            color: #6b7280;
            display: block;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.04em;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .meta-item strong {
            font-size: 11px;
            font-weight: 700;
          }
          table {
            border-collapse: collapse;
            margin-top: 10px;
            table-layout: fixed;
            width: 100%;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 7px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
          }
          th {
            background: #f1f5f9;
            font-size: 10px;
            text-transform: uppercase;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            margin: 18px 0 0;
          }
          .empty {
            color: #6b7280;
            text-align: center;
          }
          .note {
            border-top: 1px solid #cbd5e1;
            color: #4b5563;
            margin-top: 18px;
            padding-top: 10px;
            white-space: pre-wrap;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <header class="header">
          <div>
            <div class="brand">UOH Inventory Management System</div>
            <h1>${escapeHtml(title)}</h1>
            ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
          </div>
          <div class="header-right">
            ${reference ? `<div><strong>${escapeHtml(reference)}</strong></div>` : ""}
            ${status ? `<div class="badge">${escapeHtml(toTitle(status))}</div>` : ""}
            <div class="generated">Printed: ${escapeHtml(generatedAt)}</div>
          </div>
        </header>
        ${metaRows ? `<section class="meta">${metaRows}</section>` : ""}
        <div class="section-title">Item Lines</div>
        <table>
          <thead><tr>${tableHead}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
        ${note ? `<div class="note">${escapeHtml(note)}</div>` : ""}
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => window.print(), 150);
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  return true;
};
