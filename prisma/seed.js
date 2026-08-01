require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const categories = [
  { slug: 'cakes', name: 'Cakes', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80', sortOrder: 1 },
  { slug: 'brownies', name: 'Brownies', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80', sortOrder: 2 },
  { slug: 'cupcakes', name: 'Cupcakes', image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=600&q=80', sortOrder: 3 },
  { slug: 'muffins', name: 'Muffins', image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&q=80', sortOrder: 4 },
  { slug: 'cookies', name: 'Cookies', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=80', sortOrder: 5 },
  { slug: 'chocolates', name: 'Chocolates', image: 'https://images.unsplash.com/photo-1548907040-4baa419e3af8?w=600&q=80', sortOrder: 6 },
];

const products = [
  {
    name: 'Choco Truffle Cake', slug: 'choco-truffle-cake', category: 'cakes',
    description: 'Rich Belgian dark chocolate sponge layered with velvety truffle ganache.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=700&q=80',
    weights: ['500g', '1kg', '1.5kg'], priceByWeight: { '500g': 549, '1kg': 999, '1.5kg': 1449 },
    flavours: ['Dark Chocolate', 'Chocolate Chip'], featured: true,
  },
  {
    name: 'Rose Pistachio Cake', slug: 'rose-pistachio-cake', category: 'cakes',
    description: 'Delicate rose-cardamom sponge finished with crushed pistachio and edible petals.',
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=700&q=80',
    weights: ['500g', '1kg'], priceByWeight: { '500g': 649, '1kg': 1199 },
    flavours: ['Rose Cardamom'], featured: true,
  },
  {
    name: 'Red Velvet Cake', slug: 'red-velvet-cake', category: 'cakes',
    description: 'Classic red velvet with a tangy cream-cheese frosting, made the slow way.',
    image: 'https://images.unsplash.com/photo-1586985289906-406988974504?w=700&q=80',
    weights: ['500g', '1kg', '1.5kg'], priceByWeight: { '500g': 599, '1kg': 1099, '1.5kg': 1599 },
    flavours: ['Red Velvet'], featured: true,
  },
  {
    name: 'Fudge Walnut Brownies', slug: 'fudge-walnut-brownies', category: 'brownies',
    description: 'Dense, fudgy brownies studded with toasted walnuts. Sold by the box of 6.',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=700&q=80',
    weights: ['Box of 6', 'Box of 12'], priceByWeight: { 'Box of 6': 349, 'Box of 12': 649 },
    flavours: ['Classic Fudge', 'Walnut'], featured: true,
  },
  {
    name: 'Salted Caramel Cupcakes', slug: 'salted-caramel-cupcakes', category: 'cupcakes',
    description: 'Soft vanilla cupcakes topped with hand-piped salted caramel buttercream.',
    image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=700&q=80',
    weights: ['Box of 4', 'Box of 6'], priceByWeight: { 'Box of 4': 299, 'Box of 6': 429 },
    flavours: ['Salted Caramel', 'Vanilla'], featured: true,
  },
  {
    name: 'Blueberry Muffins', slug: 'blueberry-muffins', category: 'muffins',
    description: 'Bakery-style muffins loaded with real blueberries and a crackly sugar top.',
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=700&q=80',
    weights: ['Box of 4', 'Box of 6'], priceByWeight: { 'Box of 4': 259, 'Box of 6': 369 },
    flavours: ['Blueberry'], featured: false,
  },
  {
    name: 'Assorted Butter Cookies', slug: 'assorted-butter-cookies', category: 'cookies',
    description: 'A tin of five hand-shaped butter cookie varieties, perfect for gifting.',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=700&q=80',
    weights: ['250g Tin', '500g Tin'], priceByWeight: { '250g Tin': 299, '500g Tin': 549 },
    flavours: ['Butter', 'Almond', 'Chocolate Chip'], featured: false,
  },
  {
    name: 'Handmade Chocolate Box', slug: 'handmade-chocolate-box', category: 'chocolates',
    description: 'A curated box of hand-tempered chocolates — dark, milk and filled varieties.',
    image: 'https://images.unsplash.com/photo-1548907040-4baa419e3af8?w=700&q=80',
    weights: ['9 pcs', '16 pcs'], priceByWeight: { '9 pcs': 399, '16 pcs': 699 },
    flavours: ['Assorted'], featured: true,
  },
];

const galleryImages = [
  { category: 'Birthday Cakes', image: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=700&q=80', alt: 'Pastel birthday cake with sprinkles' },
  { category: 'Wedding Cakes', image: 'https://images.unsplash.com/photo-1519340333755-c1aa5571fd46?w=700&q=80', alt: 'Three-tier white wedding cake' },
  { category: 'Kids Theme Cakes', image: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=700&q=80', alt: 'Colourful kids theme cake' },
  { category: 'Cupcakes', image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=700&q=80', alt: 'Frosted cupcakes on a stand' },
  { category: 'Brownies', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=700&q=80', alt: 'Stacked fudge brownies' },
  { category: 'Anniversary Cakes', image: 'https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=700&q=80', alt: 'Rose-decorated anniversary cake' },
  { category: 'Festival Collection', image: 'https://images.unsplash.com/photo-1605196560547-b2f7281b7355?w=700&q=80', alt: 'Festive dessert platter' },
  { category: 'Behind the Scenes', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=700&q=80', alt: 'Baker icing a cake in the kitchen' },
  { category: 'Customer Celebrations', image: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=700&q=80', alt: 'Friends celebrating with cake' },
  { category: 'Chocolates', image: 'https://images.unsplash.com/photo-1548907040-4baa419e3af8?w=700&q=80', alt: 'Handmade chocolate assortment' },
  { category: 'Cookies', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=700&q=80', alt: 'Butter cookies on a rack' },
  { category: 'Wedding Cakes', image: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=700&q=80', alt: 'Floral wedding cake detail' },
];

const offers = [
  {
    festival: 'Raksha Bandhan', title: 'Raksha Bandhan is Here!',
    description: 'Celebrate the bond of love with homemade treats made with love.',
    banner: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=1200&q=80',
    discount: '10% OFF', ctaText: 'Pre-Order Now',
    startDate: new Date('2026-08-01'), endDate: new Date('2026-08-09'), active: true, priority: 1,
  },
  {
    festival: 'Diwali', title: 'A Diwali Full of Sweetness',
    description: 'Light up celebrations with festive hampers of chocolates and cookies.',
    banner: 'https://images.unsplash.com/photo-1605196560547-b2f7281b7355?w=1200&q=80',
    discount: '15% OFF', ctaText: 'Order for Diwali',
    startDate: new Date('2026-11-01'), endDate: new Date('2026-11-12'), active: false, priority: 2,
  },
];

const testimonials = [
  { name: 'Priya Sharma', rating: 5, review: "The rose pistachio cake was the highlight of my sister's Rakhi celebration. Every slice disappeared in minutes!", photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80', featured: true },
  { name: 'Karan Mehta', rating: 5, review: 'Ordered a custom anniversary cake with almost no notice and Tulsi still delivered something beautiful and delicious.', photo: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&q=80', featured: true },
  { name: 'Ananya Desai', rating: 5, review: 'Genuinely tastes homemade — not overly sweet, generous with the good ingredients. Our new go-to for every birthday.', photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80', featured: true },
  { name: 'Rohan Iyer', rating: 4, review: 'Loved the brownies — fudgy in the middle, exactly how I like them. WhatsApp ordering made it so easy.', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80', featured: false },
];

async function main() {
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await prisma.admin.upsert({
    where: { email: process.env.ADMIN_EMAIL },
    update: {},
    create: {
      name: process.env.ADMIN_NAME || 'Admin',
      email: process.env.ADMIN_EMAIL,
      passwordHash,
    },
  });
  console.log(`Admin seeded: ${process.env.ADMIN_EMAIL}`);

  await prisma.websiteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      siteName: 'Cakes by Tulsi',
      tagline: 'Homemade Cakes, Crafted with Love',
      description: 'Freshly baked cakes, brownies, chocolates and desserts made for every celebration.',
      phone: '+91 87806 52597',
      whatsapp: '918780652597',
      email: 'hello@cakesbytulsi.in',
      address: 'Vadodara, Gujarat, India',
      hours: 'Tue–Sun, 10:00 AM – 8:00 PM (Closed Mondays)',
      instagram: 'https://instagram.com',
      facebook: 'https://facebook.com',
    },
  });
  console.log('Website settings seeded');

  const categoryIdBySlug = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, image: c.image, sortOrder: c.sortOrder, status: 'LIVE' },
    });
    categoryIdBySlug[c.slug] = row.id;
  }
  console.log(`Categories seeded: ${categories.length}`);

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        categoryId: categoryIdBySlug[p.category],
        description: p.description,
        weights: p.weights,
        priceByWeight: p.priceByWeight,
        flavours: p.flavours,
        featured: p.featured,
        available: true,
        status: 'LIVE',
      },
    });
    const existingImage = await prisma.productImage.findFirst({ where: { productId: product.id } });
    if (!existingImage) {
      await prisma.productImage.create({
        data: { productId: product.id, url: p.image, isPrimary: true, sortOrder: 0 },
      });
    }
  }
  console.log(`Products seeded: ${products.length}`);

  const galleryCount = await prisma.gallery.count();
  if (galleryCount === 0) {
    await prisma.gallery.createMany({
      data: galleryImages.map((g, i) => ({ ...g, status: 'LIVE', sortOrder: i })),
    });
  }
  console.log('Gallery seeded');

  const offerCount = await prisma.offer.count();
  if (offerCount === 0) {
    await prisma.offer.createMany({ data: offers.map((o) => ({ ...o, status: 'LIVE' })) });
  }
  console.log('Offers seeded');

  const bannerCount = await prisma.heroBanner.count();
  if (bannerCount === 0) {
    await prisma.heroBanner.create({
      data: {
        image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1920&q=80',
        title: 'Homemade Cakes Crafted with Love',
        priority: 1,
        status: 'LIVE',
      },
    });
  }
  console.log('Hero banner seeded');

  const testimonialCount = await prisma.testimonial.count();
  if (testimonialCount === 0) {
    await prisma.testimonial.createMany({
      data: testimonials.map((t, i) => ({ ...t, approved: true, status: 'LIVE', sortOrder: i })),
    });
  }
  console.log('Testimonials seeded');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
