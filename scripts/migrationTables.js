// Every model, listed parent-before-child so an import can insert straight
// down the list without ever hitting a foreign-key violation. Shared by
// exportData.js and importData.js so the two can never drift apart.
//
// `model` is the Prisma client accessor; `table` is the underlying table name,
// needed on import to reset Postgres' identity sequences.
const TABLES = [
  { model: 'admin', table: 'admins' },
  { model: 'passwordResetToken', table: 'password_reset_tokens' },
  { model: 'otpCode', table: 'otp_codes' },
  { model: 'refreshToken', table: 'refresh_tokens' },
  { model: 'category', table: 'categories' },
  { model: 'product', table: 'products' },
  { model: 'productImage', table: 'product_images' },
  { model: 'gallery', table: 'gallery' },
  { model: 'offer', table: 'offers' },
  { model: 'heroBanner', table: 'hero_banners' },
  { model: 'testimonial', table: 'testimonials' },
  { model: 'websiteSettings', table: 'website_settings' },
  { model: 'contactMessage', table: 'contact_messages' },
  { model: 'analytics', table: 'analytics' },
  { model: 'order', table: 'orders' },
  { model: 'orderItem', table: 'order_items' },
  { model: 'auditLog', table: 'audit_logs' },
];

module.exports = { TABLES };
