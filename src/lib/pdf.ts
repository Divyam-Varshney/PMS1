// ============================================================================
// File: src/lib/pdf.ts
// Purpose: Premium PDF invoice generation using jsPDF + autoTable.
//          Produces a clean, professional A4 pharmacy invoice with:
//            • Header band — store logo + name (left) and INVOICE box (right)
//            • Store contact block — address / phone / email / license / GST
//            • Bill To + Ship To two-column block
//            • Order meta — order number, date, payment method, payment status
//            • Items table — # | Item Name | Qty | MRP | Disc% | Amount
//            • Totals — Item Total (MRP), Product Discount, After Discount,
//              Voucher Discount, Loyalty Discount, Delivery, Grand Total
//            • Footer — thank you note, return policy, store contact
// Role: Called from the customer "Download Invoice" button and the admin
//       order detail page. Returns a Uint8Array the browser can download.
// ============================================================================

import { getAllSettings } from "@/lib/settings";

// Lazy-load jspdf + autoTable ONLY when a PDF is actually generated.
// These libraries are ~29MB combined — loading them eagerly on every server
// startup wastes RAM and slows cold starts. Dynamic import means they're only
// loaded when /api/invoice or /api/admin/orders/[id]/invoice is called.
let _jsPDF: typeof import("jspdf").jsPDF | null = null;
let _autoTable: typeof import("jspdf-autotable").default | null = null;

async function loadPdfLibs() {
  if (!_jsPDF) {
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    _jsPDF = jsPDF;
    _autoTable = autoTableMod.default;
  }
  return { jsPDF: _jsPDF!, autoTable: _autoTable! };
}

export interface InvoiceLine {
  name: string;
  sku?: string | null;
  qty: number;
  mrp: number;
  unitPrice: number;
  appliedDiscountPct: number;
  lineTotal: number;
}

export interface InvoiceData {
  orderNumber: string;
  invoiceNumber: string;
  orderDate: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentTxnId?: string;
  paymentGateway?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shipLine1: string;
  shipLine2?: string;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  shipDistrict?: string;
  shipLocality?: string;
  lines: InvoiceLine[];
  itemsTotal: number;
  productDiscount: number;
  voucherDiscount: number;
  voucherCode?: string;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscount?: number;
  deliveryCharge: number;
  taxTotal: number;
  grandTotal: number;
  source?: string;
  prescriptionId?: string | null;
  notes?: string | null;
}

// Professional palette — emerald primary with neutral dark/gray.
const EMERALD: [number, number, number] = [5, 150, 105];
const EMERALD_DARK: [number, number, number] = [4, 120, 87];
const DARK: [number, number, number] = [17, 24, 39];
const GRAY: [number, number, number] = [107, 114, 128];
const LIGHT_GRAY: [number, number, number] = [229, 231, 235];
const SOFT_BG: [number, number, number] = [240, 253, 244];
const AMBER: [number, number, number] = [245, 158, 11];

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const settings = await getAllSettings();
  const storeName = settings["store.name"] ?? "Pradeep Medical Store";
  const storeTagline = settings["store.tagline"] ?? "";
  const storeEmail = settings["store.email"] ?? "";
  const storePhone = settings["store.phone"] ?? "";
  const storeAddress = settings["store.address"] ?? "";
  const gstNumber = settings["store.gstNumber"] ?? "";
  const license = settings["store.licenseNumber"] ?? "";
  const footerNote = settings["invoice.footerNote"] ?? "";
  const showGst = settings["invoice.showGst"] ?? true;
  // Prefer the dedicated invoice logo (uploaded via Admin → Branding) and fall
  // back to the main store logo, then to the email-logo setting, then to none.
  const storeLogo =
    (settings["store.invoiceLogo"] as string | undefined) ||
    (settings["store.logo"] as string | undefined) ||
    (settings["store.emailLogo"] as string | undefined) ||
    "";

  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // =====================================================================
  // 1. TOP ACCENT BAND — three thin stripes (dark → emerald → soft mint)
  // =====================================================================
  doc.setFillColor(...EMERALD_DARK);
  doc.rect(0, 0, pageWidth, 5, "F");
  doc.setFillColor(...EMERALD);
  doc.rect(0, 5, pageWidth, 4, "F");
  doc.setFillColor(...SOFT_BG);
  doc.rect(0, 9, pageWidth, 2, "F");

  y = 36;

  // =====================================================================
  // 2. HEADER — Logo + store name/tagline (left) | INVOICE card (right)
  // =====================================================================
  const logoSize = 48;
  let textLeftX = margin;
  if (storeLogo) {
    try {
      // White rounded background behind the logo for contrast against any
      // logo color (especially when the logo is dark-on-transparent).
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin - 2, y - 8, logoSize + 4, logoSize + 4, 4, 4, "FD");
      doc.addImage(storeLogo, "PNG", margin, y - 6, logoSize, logoSize);
      textLeftX = margin + logoSize + 14;
    } catch (e) {
      console.error("[pdf] logo error:", e);
    }
  }

  // Store name + tagline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...EMERALD);
  doc.text(storeName, textLeftX, y + 4);

  if (storeTagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(storeTagline, textLeftX, y + 18);
  }

  // Store contact (under the name, on two lines if needed)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  if (storeAddress) {
    const addrLines = doc.splitTextToSize(storeAddress, 220);
    doc.text(addrLines.slice(0, 2), textLeftX, y + 30);
  }
  if (storePhone || storeEmail) {
    doc.text(
      `${storePhone ? `Ph: ${storePhone}` : ""}${storePhone && storeEmail ? "   ·   " : ""}${storeEmail ? storeEmail : ""}`,
      textLeftX,
      y + 44
    );
  }

  // INVOICE card (right side) — emerald gradient panel
  const cardW = 180;
  const cardH = 84;
  const cardX = pageWidth - margin - cardW;
  const cardY = y - 12;
  doc.setFillColor(...EMERALD_DARK);
  doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "F");
  // Subtle emerald highlight band at the top of the card
  doc.setFillColor(...EMERALD);
  doc.roundedRect(cardX, cardY, cardW, 22, 8, 8, "F");
  doc.setFillColor(...EMERALD);
  doc.rect(cardX, cardY + 12, cardW, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TAX INVOICE", cardX + cardW / 2, cardY + 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(209, 250, 229);
  doc.text("Invoice No.", cardX + 14, cardY + 38);
  doc.text("Order No.", cardX + 14, cardY + 52);
  doc.text("Date (IST)", cardX + 14, cardY + 66);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(data.invoiceNumber, cardX + cardW - 14, cardY + 38, { align: "right" });
  doc.text(data.orderNumber, cardX + cardW - 14, cardY + 52, { align: "right" });
  // Split orderDate onto two lines if it includes time (it now contains " · " separator)
  const dateParts = data.orderDate.split(" · ");
  if (dateParts.length === 2) {
    doc.setFontSize(8);
    doc.text(dateParts[0], cardX + cardW - 14, cardY + 64, { align: "right" });
    doc.setFontSize(7);
    doc.setTextColor(209, 250, 229);
    doc.text(dateParts[1], cardX + cardW - 14, cardY + 74, { align: "right" });
  } else {
    doc.text(data.orderDate, cardX + cardW - 14, cardY + 66, { align: "right" });
  }

  y = cardY + cardH + 18;

  // Light divider
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.6);
  doc.line(margin, y - 6, pageWidth - margin, y - 6);

  // =====================================================================
  // 3. BILL TO + SHIP TO + PAYMENT INFO (three columns)
  // =====================================================================
  const colW = contentWidth / 3;
  const billX = margin;
  const shipX = margin + colW + 6;
  const payX = margin + colW * 2 + 12;

  // -- BILL TO --
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...EMERALD_DARK);
  doc.text("BILL TO", billX, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(data.customerName || "Customer", billX, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  let billY = y + 26;
  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, billX, billY);
    billY += 11;
  }
  if (data.customerEmail) {
    const emailLines = doc.splitTextToSize(data.customerEmail, colW - 8);
    doc.text(emailLines.slice(0, 2), billX, billY);
    billY += emailLines.slice(0, 2).length * 11;
  }

  // -- SHIP TO --
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...EMERALD_DARK);
  doc.text("SHIP TO", shipX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let shipY = y + 13;
  if (data.shipLine1) {
    const shipLines1 = doc.splitTextToSize(data.shipLine1, colW - 8);
    doc.text(shipLines1, shipX, shipY);
    shipY += shipLines1.length * 11;
  }
  if (data.shipLine2) {
    const shipLines2 = doc.splitTextToSize(data.shipLine2, colW - 8);
    doc.text(shipLines2, shipX, shipY);
    shipY += shipLines2.length * 11;
  }
  const localityPart = data.shipLocality ? `${data.shipLocality}, ` : "";
  const cityLine = `${localityPart}${data.shipCity}${data.shipDistrict ? `, ${data.shipDistrict}` : ""}`;
  if (cityLine.trim()) {
    const cityLines = doc.splitTextToSize(cityLine, colW - 8);
    doc.text(cityLines, shipX, shipY);
    shipY += cityLines.length * 11;
  }
  doc.text(`${data.shipState} - ${data.shipPincode}`, shipX, shipY);

  // -- PAYMENT INFO --
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...EMERALD_DARK);
  doc.text("PAYMENT INFO", payX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text("Method:", payX, y + 14);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  const payMethodText = data.paymentMethod.toUpperCase();
  doc.text(doc.splitTextToSize(payMethodText, colW - 50), payX + 42, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text("Status:", payX, y + 28);
  // Color-coded payment status badge
  const payStatusUpper = data.paymentStatus.toUpperCase();
  const statusColor: [number, number, number] =
    data.paymentStatus === "paid"
      ? EMERALD
      : data.paymentStatus === "failed"
        ? [239, 68, 68]
        : data.paymentStatus === "refunded"
          ? [156, 163, 175]
          : AMBER;
  doc.setFillColor(...statusColor);
  doc.roundedRect(payX + 42, y + 20, doc.getTextWidth(payStatusUpper) + 14, 12, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(payStatusUpper, payX + 42 + 7, y + 28);

  let payInfoY = y + 42;
  if (data.paymentTxnId) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("Txn ID:", payX, payInfoY);
    doc.setTextColor(...DARK);
    doc.setFont("courier", "bold");
    doc.setFontSize(7.5);
    const txnLines = doc.splitTextToSize(data.paymentTxnId, colW - 50);
    doc.text(txnLines.slice(0, 2), payX + 42, payInfoY);
    payInfoY += txnLines.slice(0, 2).length * 10 + 2;
    doc.setFont("helvetica", "normal");
  }
  if (data.paymentGateway) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("Gateway:", payX, payInfoY);
    doc.setTextColor(...DARK);
    doc.text(data.paymentGateway.toUpperCase(), payX + 42, payInfoY);
  }

  y = Math.max(billY, shipY, payInfoY) + 18;

  // =====================================================================
  // 4. ORDER META PANEL — single-row soft panel with key info
  // =====================================================================
  const panelH = 26;
  doc.setFillColor(...SOFT_BG);
  doc.roundedRect(margin, y, contentWidth, panelH, 4, 4, "F");
  // Left accent stripe
  doc.setFillColor(...EMERALD);
  doc.roundedRect(margin, y, 3, panelH, 1.5, 1.5, "F");

  const metaItems: Array<{ label: string; value: string }> = [
    { label: "ORDER DATE", value: data.orderDate },
    { label: "ORDER STATUS", value: data.status.toUpperCase() },
    { label: "SOURCE", value: (data.source || "cart").toUpperCase() },
  ];
  if (data.prescriptionId) {
    metaItems.push({ label: "PRESCRIPTION", value: "VERIFIED" });
  }
  const metaColW = contentWidth / metaItems.length;
  metaItems.forEach((m, i) => {
    const cx = margin + metaColW * i + metaColW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(m.label, cx, y + 9, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    // Truncate value if too long for the column
    let val = m.value;
    const maxW = metaColW - 12;
    while (doc.getTextWidth(val) > maxW && val.length > 4) {
      val = val.slice(0, -2);
    }
    if (val !== m.value) val = val.slice(0, -1) + "…";
    doc.text(val, cx, y + 19, { align: "center" });
  });

  y += panelH + 14;

  // =====================================================================
  // 5. ITEMS TABLE — # | Item Name | HSN | Qty | MRP | Disc% | Rate | Amount
  // =====================================================================
  autoTable(doc, {
    startY: y,
    head: [["#", "Item Name", "Qty", "MRP", "Disc%", "Rate", "Amount"]],
    body: data.lines.map((l, i) => {
      const rate = l.qty > 0 ? Number(l.lineTotal) / l.qty : Number(l.lineTotal);
      return [
        String(i + 1),
        l.name + (l.sku ? `\n${l.sku}` : ""),
        String(l.qty),
        `Rs. ${Number(l.mrp).toFixed(2)}`,
        l.appliedDiscountPct > 0 ? `${Number(l.appliedDiscountPct).toFixed(1)}%` : "-",
        `Rs. ${rate.toFixed(2)}`,
        `Rs. ${Number(l.lineTotal).toFixed(2)}`,
      ];
    }),
    theme: "striped",
    headStyles: {
      fillColor: EMERALD,
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
      lineColor: EMERALD_DARK,
      lineWidth: 0.3,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: DARK,
      lineColor: LIGHT_GRAY,
      lineWidth: 0.2,
      cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
    },
    alternateRowStyles: { fillColor: SOFT_BG },
    columnStyles: {
      0: { halign: "center", cellWidth: 26, fontStyle: "bold" },
      1: { halign: "left", cellWidth: "auto" },
      2: { halign: "center", cellWidth: 32 },
      3: { halign: "right", cellWidth: 60 },
      4: { halign: "center", cellWidth: 42 },
      5: { halign: "right", cellWidth: 60 },
      6: { halign: "right", cellWidth: 70, fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore — lastAutoTable is added by the plugin
  y = (doc as any).lastAutoTable.finalY + 16;

  // =====================================================================
  // 6. TOTALS — right-aligned totals block + amount-in-words (left)
  // =====================================================================
  const totalsW = 250;
  const tx = pageWidth - margin - totalsW;
  const totalsLeftPad = 10;

  const afterDiscount = Math.max(0, Number(data.itemsTotal) - Number(data.productDiscount));
  const totalDiscount = Number(data.productDiscount) + Number(data.loyaltyDiscount ?? 0) + Number(data.voucherDiscount);

  // Soft panel behind totals
  const totalsStartY = y - 4;
  const line = (
    label: string,
    value: string,
    opts: { bold?: boolean; color?: [number, number, number]; size?: number } = {}
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? (opts.bold ? 10 : 9));
    doc.setTextColor(...(opts.color ?? (opts.bold ? DARK : GRAY)));
    doc.text(label, tx + totalsLeftPad, y);
    doc.text(value, pageWidth - margin - totalsLeftPad, y, { align: "right" });
    y += opts.bold ? 18 : 14;
  };

  line("Item Total (MRP)", `Rs. ${Number(data.itemsTotal).toFixed(2)}`);
  if (data.productDiscount > 0) {
    line("Product Discount", `- Rs. ${Number(data.productDiscount).toFixed(2)}`, { color: EMERALD });
  }
  line("After Discount", `Rs. ${Number(afterDiscount).toFixed(2)}`, { bold: true });
  if (data.voucherDiscount > 0) {
    line(
      `Voucher Discount${data.voucherCode ? ` (${data.voucherCode})` : ""}`,
      `- Rs. ${Number(data.voucherDiscount).toFixed(2)}`,
      { color: EMERALD }
    );
  }
  if (data.loyaltyDiscount && data.loyaltyDiscount > 0) {
    line(
      `Loyalty Discount${data.loyaltyPointsRedeemed ? ` (${data.loyaltyPointsRedeemed} pts)` : ""}`,
      `- Rs. ${Number(data.loyaltyDiscount).toFixed(2)}`,
      { color: AMBER }
    );
  }
  if (totalDiscount > 0) {
    line("Total Discount", `- Rs. ${totalDiscount.toFixed(2)}`, { bold: true, color: EMERALD });
  }
  line(
    "Delivery Charges",
    Number(data.deliveryCharge) === 0 ? "FREE" : `Rs. ${Number(data.deliveryCharge).toFixed(2)}`,
    { color: Number(data.deliveryCharge) === 0 ? EMERALD : undefined }
  );
  if (Number(data.taxTotal) > 0) line("Tax (incl. GST)", `Rs. ${Number(data.taxTotal).toFixed(2)}`);

  // Background panel for the totals section (drawn after the lines so we know the height)
  doc.setFillColor(...SOFT_BG);
  const totalsBgH = y - totalsStartY + 6;
  doc.roundedRect(tx - 4, totalsStartY - 8, pageWidth - margin - tx + 4, totalsBgH, 4, 4, "F");

  // Re-render all the totals lines on top of the panel (since the panel covered them)
  y = totalsStartY;
  line("Item Total (MRP)", `Rs. ${Number(data.itemsTotal).toFixed(2)}`);
  if (data.productDiscount > 0) {
    line("Product Discount", `- Rs. ${Number(data.productDiscount).toFixed(2)}`, { color: EMERALD });
  }
  line("After Discount", `Rs. ${Number(afterDiscount).toFixed(2)}`, { bold: true });
  if (data.voucherDiscount > 0) {
    line(
      `Voucher Discount${data.voucherCode ? ` (${data.voucherCode})` : ""}`,
      `- Rs. ${Number(data.voucherDiscount).toFixed(2)}`,
      { color: EMERALD }
    );
  }
  if (data.loyaltyDiscount && data.loyaltyDiscount > 0) {
    line(
      `Loyalty Discount${data.loyaltyPointsRedeemed ? ` (${data.loyaltyPointsRedeemed} pts)` : ""}`,
      `- Rs. ${Number(data.loyaltyDiscount).toFixed(2)}`,
      { color: AMBER }
    );
  }
  if (totalDiscount > 0) {
    line("Total Discount", `- Rs. ${totalDiscount.toFixed(2)}`, { bold: true, color: EMERALD });
  }
  line(
    "Delivery Charges",
    Number(data.deliveryCharge) === 0 ? "FREE" : `Rs. ${Number(data.deliveryCharge).toFixed(2)}`,
    { color: Number(data.deliveryCharge) === 0 ? EMERALD : undefined }
  );
  if (Number(data.taxTotal) > 0) line("Tax (incl. GST)", `Rs. ${Number(data.taxTotal).toFixed(2)}`);

  // Grand total bar — emerald, prominent
  y += 6;
  const gtBarH = 34;
  doc.setFillColor(...EMERALD_DARK);
  doc.roundedRect(tx - 4, y - 12, pageWidth - margin - tx + 4, gtBarH, 5, 5, "F");
  // Inner emerald stripe
  doc.setFillColor(...EMERALD);
  doc.roundedRect(tx - 4, y - 12, 4, gtBarH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", tx + totalsLeftPad, y + 8);
  doc.setFontSize(13);
  doc.text(`Rs. ${Number(data.grandTotal).toFixed(2)}`, pageWidth - margin - totalsLeftPad, y + 8, {
    align: "right",
  });
  y += gtBarH + 4;

  // Amount in words (left, beneath totals)
  const amountInWords = numberToIndianWords(Number(data.grandTotal));
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Amount in words: ${amountInWords} only`, margin, y + 6);

  // =====================================================================
  // 7. GST SUMMARY (if applicable)
  // =====================================================================
  if (showGst && (gstNumber || license)) {
    let gstY = y + 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...EMERALD_DARK);
    doc.text("GST & LICENSE DETAILS", margin, gstY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const gstLine = [
      gstNumber ? `GSTIN: ${gstNumber}` : null,
      license ? `Drug License: ${license}` : null,
    ].filter(Boolean).join("   ·   ");
    if (gstLine) doc.text(gstLine, margin, gstY + 11);
    y = gstY + 18;
  }

  // =====================================================================
  // 8. NOTES / INSTRUCTIONS
  // =====================================================================
  if (data.notes) {
    let notesY = y + 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...EMERALD_DARK);
    doc.text("ORDER NOTES", margin, notesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(splitNotes, margin, notesY + 11);
    y = notesY + 11 + splitNotes.length * 11;
  }

  // =====================================================================
  // 9. FOOTER — Thank you, return policy, signature line, store contact
  // =====================================================================
  const footerY = pageHeight - 90;

  // Decorative emerald line above footer
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(1.5);
  doc.line(margin, footerY - 4, margin + 40, footerY - 4);
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.4);
  doc.line(margin + 44, footerY - 4, pageWidth - margin, footerY - 4);

  // Thank you + return-policy block (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...EMERALD);
  doc.text(`Thank you for choosing ${storeName}!`, margin, footerY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  if (footerNote) {
    const splitFooter = doc.splitTextToSize(`Return Policy: ${footerNote}`, contentWidth - 220);
    doc.text(splitFooter, margin, footerY + 26);
  } else {
    doc.text("This is a computer-generated invoice and does not require a signature.", margin, footerY + 26);
  }

  // Signature line (right side of footer)
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.4);
  doc.line(pageWidth - margin - 160, footerY + 38, pageWidth - margin, footerY + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text("Authorised Signatory", pageWidth - margin - 80, footerY + 48, { align: "center" });

  // Bottom-most line — copyright + store contact
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.4);
  doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `© ${new Date().getFullYear()} ${storeName}  ·  ${storePhone}${storeEmail ? "  ·  " + storeEmail : ""}`,
    margin,
    pageHeight - 18
  );
  doc.text("Computer-generated invoice · No signature required", pageWidth - margin, pageHeight - 18, { align: "right" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ---------------------------------------------------------------------------
// Helper — convert a number to Indian English words for the "Amount in
// words" line on the invoice. Handles up to crores.
// ---------------------------------------------------------------------------
function numberToIndianWords(num: number): string {
  if (!isFinite(num)) return "Zero";
  const integerPart = Math.floor(num);
  const paisa = Math.round((num - integerPart) * 100);
  if (integerPart === 0 && paisa === 0) return "Zero Rupees";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }
  function threeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const parts: string[] = [];
    if (h) parts.push(ones[h] + " Hundred");
    if (r) parts.push(twoDigits(r));
    return parts.join(" ");
  }

  function inWords(n: number): string {
    if (n === 0) return "";
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const rest = n;
    const parts: string[] = [];
    if (crore) parts.push(inWords(crore) + " Crore");
    if (lakh) parts.push(twoDigits(lakh) + " Lakh");
    if (thousand) parts.push(twoDigits(thousand) + " Thousand");
    if (rest) parts.push(threeDigits(rest));
    return parts.join(" ").trim();
  }

  const rupeeWords = inWords(integerPart);
  let result = rupeeWords ? `${rupeeWords} Rupees` : "Zero Rupees";
  if (paisa > 0) {
    result += ` and ${twoDigits(paisa)} Paise`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// SHIPPING LABEL PDF GENERATION — Professional A5 format
// A5 = 148mm × 210mm (compact, courier-standard label size)
// Layout: Store header band → From/To dual-column → Order meta bar →
//         Package info grid → Tear-off perforation → Return address footer
// ---------------------------------------------------------------------------

export interface ShippingLabelData {
  orderNumber: string;
  orderDate: string;
  orderValue: number;
  paymentMethod: string;
  paymentStatus: string;
  // Shipping details
  customerName: string;
  customerPhone: string;
  shipLine1: string;
  shipLine2?: string;
  shipLocality?: string;
  shipCity: string;
  shipDistrict: string;
  shipState: string;
  shipPincode: string;
  // Store info (read from settings inside the function)
  // Additional info
  packageNumber?: string;
  itemsCount?: number;
  notes?: string;
}

/** Generate a professional A5 shipping label PDF. Returns a Uint8Array. */
export async function generateShippingLabelPdf(data: ShippingLabelData): Promise<Uint8Array> {
  const settings = await getAllSettings();
  const storeName = settings["store.name"] || "Pradeep Medical Store";
  const storeAddress = settings["store.address"] || "";
  const storePhone = settings["store.phone"] || "";
  const storeEmail = settings["store.email"] || "";
  const storeGst = settings["store.gstNumber"] || "";
  const storeLogo = settings["store.logo"] as string | undefined;
  const licenseNumber = settings["store.licenseNumber"] || "";

  // A5 = 148 × 210 mm. Using "pt" (1pt = 1/72 inch, 1mm ≈ 2.835pt).
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ unit: "pt", format: [419.53, 595.28] }); // A5 portrait
  const pageWidth = 419.53;
  const pageHeight = 595.28;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Color palette
  const EMERALD: [number, number, number] = [5, 150, 105];
  const EMERALD_DARK: [number, number, number] = [4, 120, 87];
  const DARK: [number, number, number] = [17, 24, 39];
  const GRAY: [number, number, number] = [107, 114, 128];
  const LIGHT_GRAY: [number, number, number] = [156, 163, 175];
  const BORDER: [number, number, number] = [229, 231, 235];
  const BG_LIGHT: [number, number, number] = [249, 250, 251];
  const BG_EMERALD: [number, number, number] = [236, 253, 245];

  // ═══════════════════════════════════════════════════════════════════════
  // 1. HEADER BAND — Emerald gradient bar with store logo + name
  // ═══════════════════════════════════════════════════════════════════════
  doc.setFillColor(...EMERALD_DARK);
  doc.rect(0, 0, pageWidth, 60, "F");
  doc.setFillColor(...EMERALD);
  doc.rect(0, 56, pageWidth, 4, "F"); // accent line at bottom of band

  let y = 22;
  const logoSize = 28;

  if (storeLogo) {
    try {
      // White rounded background for logo visibility
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, y - 6, logoSize, logoSize, 4, 4, "F");
      doc.addImage(storeLogo, "PNG", margin + 2, y - 4, logoSize - 4, logoSize - 4);
    } catch {
      // skip if logo URL is invalid
    }
  }

  // Store name (white, bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(storeName, margin + logoSize + 10, y);

  // Store tagline / contact (white, small)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(209, 250, 229); // emerald-100
  const contactShort = [storePhone, storeEmail].filter(Boolean).join("  ·  ");
  doc.text(contactShort, margin + logoSize + 10, y + 12);

  // "SHIPPING LABEL" label (right side of header, uppercase)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229);
  doc.text("SHIPPING LABEL", pageWidth - margin, y, { align: "right" });

  // Package number (right side, below)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(167, 243, 208);
  doc.text(`PKG #${data.packageNumber || data.orderNumber}`, pageWidth - margin, y + 12, { align: "right" });

  y = 72;

  // ═══════════════════════════════════════════════════════════════════════
  // 2. FROM / TO — Dual-column layout (courier standard)
  // ═══════════════════════════════════════════════════════════════════════
  const colWidth = (contentWidth - 4) / 2; // 2pt gap between columns
  const boxHeight = 95;
  const leftX = margin;
  const rightX = margin + colWidth + 4;

  // ── FROM box (left) ──
  doc.setFillColor(...BG_LIGHT);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(leftX, y, colWidth, boxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("FROM", leftX + 10, y + 14);

  // Store info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  doc.text(storeName, leftX + 10, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  const fromLines = [
    storeAddress,
    storePhone,
    storeEmail,
    storeGst ? `GST: ${storeGst}` : null,
    licenseNumber ? `DL: ${licenseNumber}` : null,
  ].filter(Boolean);
  let fromY = y + 40;
  for (const line of fromLines) {
    doc.text(doc.splitTextToSize(line, colWidth - 20), leftX + 10, fromY);
    fromY += 11;
  }

  // ── TO box (right) — highlighted with emerald accent ──
  doc.setFillColor(...BG_EMERALD);
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(1);
  doc.roundedRect(rightX, y, colWidth, boxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...EMERALD_DARK);
  doc.text("SHIP TO", rightX + 10, y + 14);

  // Customer name (prominent)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(doc.splitTextToSize(data.customerName, colWidth - 20), rightX + 10, y + 30);

  // Phone
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text(`Ph: ${data.customerPhone}`, rightX + 10, y + 44);

  // Address
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  const addressLines: string[] = [
    data.shipLine1,
    data.shipLine2,
    data.shipLocality,
    `${data.shipCity}, ${data.shipDistrict}`,
    `${data.shipState} - ${data.shipPincode}`,
  ].filter((l): l is string => Boolean(l));
  let toY = y + 56;
  for (const line of addressLines) {
    doc.text(doc.splitTextToSize(line, colWidth - 20), rightX + 10, toY);
    toY += 10;
  }

  y += boxHeight + 10;

  // ═══════════════════════════════════════════════════════════════════════
  // 3. ORDER META BAR — Key order info in a compact horizontal strip
  // ═══════════════════════════════════════════════════════════════════════
  doc.setFillColor(...DARK);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  const metaItems = [
    `ORDER: ${data.orderNumber}`,
    `DATE: ${data.orderDate}`,
    `VALUE: Rs. ${Number(data.orderValue).toFixed(2)}`,
  ];
  const metaItemWidth = contentWidth / metaItems.length;
  metaItems.forEach((item, i) => {
    doc.text(item, margin + (metaItemWidth * i) + 8, y + 14);
  });

  // Payment status (right-aligned, color-coded badge)
  const payStatusColor: [number, number, number] =
    data.paymentStatus === "paid" ? [34, 197, 94] :
    data.paymentStatus === "failed" ? [239, 68, 68] :
    [251, 191, 36]; // pending = amber
  doc.setFillColor(...payStatusColor);
  doc.roundedRect(pageWidth - margin - 70, y + 4, 62, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.text(data.paymentStatus.toUpperCase(), pageWidth - margin - 39, y + 13, { align: "center" });

  y += 30;

  // ═══════════════════════════════════════════════════════════════════════
  // 4. PACKAGE INFO GRID — 2×2 info cards
  // ═══════════════════════════════════════════════════════════════════════
  const gridCols = 2;
  const gridRows = 2;
  const cellWidth = (contentWidth - 6) / gridCols; // 6pt total gap
  const cellHeight = 36;

  const gridItems = [
    { label: "PAYMENT METHOD", value: data.paymentMethod },
    { label: "ITEMS", value: String(data.itemsCount ?? "—") },
    { label: "COURIER", value: "________________" },
    { label: "WEIGHT (kg)", value: "________" },
  ];

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      const item = gridItems[idx];
      const cellX = margin + col * (cellWidth + 6);
      const cellY = y + row * (cellHeight + 4);

      doc.setFillColor(...BG_LIGHT);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.5);
      doc.roundedRect(cellX, cellY, cellWidth, cellHeight, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(...LIGHT_GRAY);
      doc.text(item.label, cellX + 8, cellY + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.text(item.value, cellX + 8, cellY + 26);
    }
  }

  y += gridRows * (cellHeight + 4) + 8;

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SHIPPING INSTRUCTIONS (if any)
  // ═══════════════════════════════════════════════════════════════════════
  if (data.notes) {
    doc.setFillColor(...BG_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 32, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text("SHIPPING INSTRUCTIONS", margin + 8, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    doc.text(doc.splitTextToSize(data.notes, contentWidth - 16), margin + 8, y + 24);

    y += 40;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. QR / BARCODE PLACEHOLDER (future-ready)
  // ═══════════════════════════════════════════════════════════════════════
  const qrSize = 48;
  const qrX = margin;
  const qrY = y;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX, qrY, qrSize, qrSize, 3, 3, "FD");

  // Draw a simple QR-like pattern (placeholder)
  doc.setFillColor(...DARK);
  const cellSize = qrSize / 8;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 3 === 0 || (r * c) % 5 === 0) {
        doc.rect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize, "F");
      }
    }
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(5);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("Scan for tracking", qrX + qrSize + 6, qrY + qrSize / 2);

  // Tracking number (right of QR)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  doc.text("TRACKING NUMBER", qrX + qrSize + 70, qrY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.setFont("courier", "normal");
  doc.text(data.orderNumber, qrX + qrSize + 70, qrY + 22);
  doc.setFont("helvetica", "normal");

  y += qrSize + 12;

  // ═══════════════════════════════════════════════════════════════════════
  // 7. TEAR-OFF PERFORATION LINE
  // ═══════════════════════════════════════════════════════════════════════
  y = Math.max(y + 4, pageHeight - 78);
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);

  // Scissors icon (✂) at left
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("✂ ---", margin, y - 2);

  y += 10;

  // ═══════════════════════════════════════════════════════════════════════
  // 8. RETURN ADDRESS FOOTER (tear-off section)
  // ═══════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  doc.text("RETURN ADDRESS", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  doc.text(storeName, margin, y + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  doc.text(doc.splitTextToSize(storeAddress, contentWidth - 20), margin, y + 22);
  doc.text(`Tel: ${storePhone}`, margin, y + 34);

  // Electronic label notice
  doc.setFont("helvetica", "italic");
  doc.setFontSize(5.5);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("Generated by PMS — Pradeep Medical Store", pageWidth - margin, pageHeight - 12, { align: "right" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
