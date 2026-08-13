const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const INVOICES_DIR = path.join(UPLOADS_ROOT, 'invoices');

const COLOR_PRIMARY = '#C6567A';
const COLOR_DARK = '#4A2A20';
const COLOR_MUTED = '#6E4436';
const COLOR_LINE = '#F2D7E1';
const COLOR_FILL = '#FCE9EE';

// The invoice number is derived from the order's own orderNumber (ORD-0001 ->
// INV-0001) rather than a separate counter, so it's always 1:1 with the order
// and can never collide.
function toInvoiceNumber(orderNumber) {
  return orderNumber.replace(/^ORD-/, 'INV-');
}

function money(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// Writes server/uploads/invoices/<INV-xxxx>.pdf, mirroring the relative-URL
// convention imageService.js already uses for uploaded images.
//
// `publicUrl`, if provided, is the invoice's own eventual absolute URL
// (resolved by the caller via absolutizeUploads' resolveBaseUrl, since this
// module has no access to the request) — it's encoded into a QR code so the
// invoice can be scanned straight to a phone. Safe to omit; the QR is
// simply skipped if no URL is known yet.
async function generateInvoice(order, settings, publicUrl) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
  const invoiceNumber = toInvoiceNumber(order.orderNumber);
  const filename = `${invoiceNumber}.pdf`;
  const destPath = path.join(INVOICES_DIR, filename);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(destPath);
  doc.pipe(stream);

  const top = 50;
  let logoDrawn = false;
  if (settings?.logo && settings.logo.startsWith('/uploads/')) {
    const logoPath = path.join(UPLOADS_ROOT, settings.logo.replace('/uploads/', ''));
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, top, { fit: [60, 60] });
        logoDrawn = true;
      } catch {
        logoDrawn = false;
      }
    }
  }

  const brandX = logoDrawn ? 120 : 50;
  doc.fillColor(COLOR_DARK).font('Helvetica-Bold').fontSize(20).text(settings?.siteName || 'Cakes by Tulsi', brandX, top + (logoDrawn ? 8 : 0));
  doc
    .fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text([settings?.address, settings?.phone, settings?.email].filter(Boolean).join('   |   '), brandX, top + 32, { width: 340 });

  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(16).text('INVOICE', 400, top, { width: 145, align: 'right' });
  doc
    .fillColor(COLOR_DARK)
    .font('Helvetica')
    .fontSize(10)
    .text(`Invoice #: ${invoiceNumber}`, 400, top + 24, { width: 145, align: 'right' })
    .text(`Order #: ${order.orderNumber}`, 400, top + 38, { width: 145, align: 'right' })
    .text(`Generated: ${formatDate(new Date())}`, 400, top + 52, { width: 145, align: 'right' });

  doc.moveTo(50, 130).lineTo(545, 130).strokeColor(COLOR_LINE).lineWidth(1).stroke();

  let leftY = 150;
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(11).text('Bill To', 50, leftY);
  leftY += 16;
  doc.fillColor(COLOR_DARK).font('Helvetica').fontSize(10);
  doc.text(order.customerName, 50, leftY, { width: 240 });
  leftY += 14;
  doc.text(order.phone, 50, leftY, { width: 240 });
  leftY += 14;
  if (order.address) {
    doc.text(order.address, 50, leftY, { width: 240 });
    leftY += 12 * Math.ceil(order.address.length / 40) + 2;
  }

  let rightY = 150;
  doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(11).text('Delivery Details', 320, rightY);
  rightY += 16;
  doc.fillColor(COLOR_DARK).font('Helvetica').fontSize(10);
  doc.text(`Type: ${order.orderType === 'DELIVERY' ? 'Home Delivery' : 'Store Pickup'}`, 320, rightY, { width: 220 });
  rightY += 14;
  doc.text(`Date & Time: ${formatDateTime(order.pickupDatetime)}`, 320, rightY, { width: 220 });
  rightY += 14;
  doc.text(`Payment Status: ${order.paymentStatus}`, 320, rightY, { width: 220 });
  rightY += 14;

  let y = Math.max(leftY, rightY) + 16;

  doc.rect(50, y, 495, 24).fill(COLOR_FILL);
  doc.fillColor(COLOR_DARK).font('Helvetica-Bold').fontSize(10);
  doc.text('Item', 60, y + 7);
  doc.text('Weight', 260, y + 7);
  doc.text('Flavour', 340, y + 7);
  doc.text('Qty', 430, y + 7);
  doc.text('Amount', 470, y + 7, { width: 65, align: 'right' });
  y += 30;

  doc.font('Helvetica').fontSize(10).fillColor(COLOR_DARK);
  // Multi-item orders: one row per product from `order.items`. Older orders
  // (or any caller that never sent items) fall back to the single legacy
  // productName/weight/flavour/quantity/totalAmount fields as one row, so
  // this never breaks for pre-existing invoices.
  const lineItems =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [
          {
            productName: order.productName,
            weight: order.weight,
            flavour: order.flavour,
            quantity: order.quantity,
            lineTotal: order.totalAmount,
            note: null,
          },
        ];

  lineItems.forEach((item) => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.font('Helvetica').fontSize(10).fillColor(COLOR_DARK);
    doc.text(item.productName, 60, y, { width: 190 });
    doc.text(item.weight || '-', 260, y);
    doc.text(item.flavour || '-', 340, y);
    doc.text(String(item.quantity), 430, y);
    doc.text(money(item.lineTotal), 470, y, { width: 65, align: 'right' });
    y += 18;
    if (item.note) {
      doc.fillColor(COLOR_MUTED).font('Helvetica-Oblique').fontSize(8).text(`Note: ${item.note}`, 60, y, { width: 480 });
      y += 12;
    }
  });
  y += 10;

  if (order.notes) {
    doc.fillColor(COLOR_MUTED).fontSize(9).text(`Message: ${order.notes}`, 60, y, { width: 480 });
    y += 12 * Math.ceil(order.notes.length / 85) + 10;
  }

  doc.moveTo(50, y).lineTo(545, y).strokeColor(COLOR_LINE).stroke();
  y += 14;

  // No tax/GST is currently tracked on an order (small home-bakery setup,
  // no tax registration in WebsiteSettings) — line kept at 0 rather than
  // invented, but present so a real tax rate can be wired in here later
  // without reshaping the invoice layout.
  const tax = 0;
  const grandTotal = Number(order.totalAmount) - Number(order.discount || 0) + tax;
  const totals = [
    ['Subtotal', money(order.totalAmount), false],
    ['Discount', `- ${money(order.discount)}`, false],
    ...(tax > 0 ? [['Tax', money(tax), false]] : []),
    ['Grand Total', money(grandTotal), true],
    ['Advance Paid', `- ${money(order.advancePaid)}`, false],
    ['Remaining Balance', money(order.remainingAmount), true],
  ];

  const totalsTop = y;
  totals.forEach(([label, value, bold]) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor(bold ? COLOR_PRIMARY : COLOR_DARK);
    doc.text(label, 320, y, { width: 130 });
    doc.text(value, 470, y, { width: 65, align: 'right' });
    y += bold ? 20 : 16;
  });

  // QR code (optional) — scanning it opens this exact invoice, handy for a
  // customer to save it straight to their phone. Sits beside the totals
  // block so it doesn't disturb the rest of the layout.
  if (publicUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 0, width: 90 });
      doc.image(qrDataUrl, 50, totalsTop, { width: 70, height: 70 });
      doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(7).text('Scan to view invoice', 45, totalsTop + 74, { width: 80, align: 'center' });
    } catch {
      // Non-essential — a failed QR render should never block the invoice itself.
    }
  }

  y += 24;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(COLOR_LINE).stroke();
  y += 16;
  doc
    .fillColor(COLOR_PRIMARY)
    .font('Helvetica-BoldOblique')
    .fontSize(11)
    .text('Thank you for choosing us for your celebration!', 50, y, { width: 495, align: 'center' });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/uploads/invoices/${filename}`;
}

module.exports = { generateInvoice, toInvoiceNumber };
