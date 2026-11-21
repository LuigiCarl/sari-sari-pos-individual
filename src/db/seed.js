require('../config/env');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/db');

async function upsertUser({ username, password, fullName, role }) {
  const { rows } = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (rows.length) return rows[0].id;
  const hash = bcrypt.hashSync(password, 10);
  const res = await query(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [username, hash, fullName, role]
  );
  console.log(`Created ${role} user "${username}" with password "${password}"`);
  return res.rows[0].id;
}

async function upsertCategory(name) {
  await query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  const { rows } = await query('SELECT id FROM categories WHERE name = $1', [name]);
  return rows[0].id;
}

async function upsertProduct(p) {
  const { rows } = await query('SELECT id, name, selling_price FROM products WHERE name = $1', [p.name]);
  if (rows.length) return rows[0];
  const res = await query(
    `INSERT INTO products (name, barcode, category_id, unit, cost_price, selling_price, stock_quantity, reorder_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, selling_price`,
    [p.name, p.barcode, p.category_id, p.unit, p.cost_price, p.selling_price, p.stock_quantity, p.reorder_level]
  );
  return res.rows[0];
}

// Deterministic pseudo-random generator so seeding is reproducible
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const adminId = await upsertUser({ username: 'admin', password: 'admin123', fullName: 'Store Owner', role: 'admin' });
  const cashier1Id = await upsertUser({ username: 'cashier1', password: 'cashier123', fullName: 'Juana Cruz', role: 'sales_rep' });
  const cashier2Id = await upsertUser({ username: 'cashier2', password: 'cashier123', fullName: 'Marco Reyes', role: 'sales_rep' });

  const snacks = await upsertCategory('Snacks');
  const beverages = await upsertCategory('Beverages');
  const household = await upsertCategory('Household');
  const canned = await upsertCategory('Canned Goods');
  const personal = await upsertCategory('Personal Care');
  const pantry = await upsertCategory('Condiments & Pantry');

  const productDefs = [
    // Snacks
    { name: 'Instant Noodles', barcode: '4800016641234', category_id: snacks, unit: 'pack', cost_price: 8, selling_price: 12, stock_quantity: 50, reorder_level: 10 },
    { name: 'Pancit Canton Calamansi', barcode: '4800016641235', category_id: snacks, unit: 'pack', cost_price: 11, selling_price: 16, stock_quantity: 42, reorder_level: 12 },
    { name: 'SkyFlakes Crackers', barcode: '4800016641236', category_id: snacks, unit: 'pack', cost_price: 6, selling_price: 9, stock_quantity: 36, reorder_level: 10 },
    { name: 'Piattos Cheese 40g', barcode: '4800016641237', category_id: snacks, unit: 'pack', cost_price: 14, selling_price: 20, stock_quantity: 22, reorder_level: 8 },
    { name: 'Choco Mucho Bar', barcode: '4800016641238', category_id: snacks, unit: 'pc', cost_price: 8, selling_price: 12, stock_quantity: 5, reorder_level: 10 },
    // Canned Goods
    { name: 'Canned Sardines', barcode: '4800016642345', category_id: canned, unit: 'can', cost_price: 15, selling_price: 22, stock_quantity: 40, reorder_level: 10 },
    { name: 'Corned Beef 150g', barcode: '4800016642346', category_id: canned, unit: 'can', cost_price: 32, selling_price: 44, stock_quantity: 18, reorder_level: 6 },
    { name: 'Century Tuna Flakes', barcode: '4800016642347', category_id: canned, unit: 'can', cost_price: 30, selling_price: 40, stock_quantity: 4, reorder_level: 8 },
    { name: 'Meat Loaf 150g', barcode: '4800016642348', category_id: canned, unit: 'can', cost_price: 22, selling_price: 30, stock_quantity: 25, reorder_level: 8 },
    // Beverages
    { name: 'Soft Drinks 1.5L', barcode: '4800016643456', category_id: beverages, unit: 'bottle', cost_price: 45, selling_price: 65, stock_quantity: 24, reorder_level: 6 },
    { name: 'Bottled Water 500mL', barcode: '4800016644567', category_id: beverages, unit: 'bottle', cost_price: 7, selling_price: 12, stock_quantity: 60, reorder_level: 12 },
    { name: '3-in-1 Coffee Sachet', barcode: '4800016643458', category_id: beverages, unit: 'sachet', cost_price: 6, selling_price: 10, stock_quantity: 85, reorder_level: 20 },
    { name: 'C2 Green Tea 355mL', barcode: '4800016643459', category_id: beverages, unit: 'bottle', cost_price: 16, selling_price: 24, stock_quantity: 28, reorder_level: 10 },
    { name: 'Milo Energy Sachet', barcode: '4800016643460', category_id: beverages, unit: 'sachet', cost_price: 8, selling_price: 12, stock_quantity: 0, reorder_level: 15 },
    { name: 'Cobra Energy Drink', barcode: '4800016643461', category_id: beverages, unit: 'bottle', cost_price: 16, selling_price: 22, stock_quantity: 19, reorder_level: 8 },
    // Household
    { name: 'Laundry Soap Bar', barcode: '4800016645678', category_id: household, unit: 'pc', cost_price: 10, selling_price: 15, stock_quantity: 30, reorder_level: 8 },
    { name: 'Detergent Powder Sachet', barcode: '4800016645679', category_id: household, unit: 'sachet', cost_price: 6, selling_price: 10, stock_quantity: 55, reorder_level: 15 },
    { name: 'Dishwashing Liquid 250mL', barcode: '4800016645680', category_id: household, unit: 'bottle', cost_price: 38, selling_price: 52, stock_quantity: 12, reorder_level: 5 },
    { name: 'Fabric Conditioner Sachet', barcode: '4800016645681', category_id: household, unit: 'sachet', cost_price: 6, selling_price: 9, stock_quantity: 6, reorder_level: 12 },
    // Personal Care
    { name: 'Bath Soap 90g', barcode: '4800016647001', category_id: personal, unit: 'pc', cost_price: 20, selling_price: 28, stock_quantity: 24, reorder_level: 6 },
    { name: 'Shampoo Sachet', barcode: '4800016647002', category_id: personal, unit: 'sachet', cost_price: 5, selling_price: 8, stock_quantity: 70, reorder_level: 20 },
    { name: 'Toothpaste Sachet', barcode: '4800016647003', category_id: personal, unit: 'sachet', cost_price: 6, selling_price: 10, stock_quantity: 45, reorder_level: 12 },
    // Condiments & Pantry
    { name: 'Cooking Oil 1L', barcode: '4800016646789', category_id: pantry, unit: 'bottle', cost_price: 60, selling_price: 80, stock_quantity: 15, reorder_level: 5 },
    { name: 'Soy Sauce 385mL', barcode: '4800016646790', category_id: pantry, unit: 'bottle', cost_price: 18, selling_price: 26, stock_quantity: 20, reorder_level: 6 },
    { name: 'White Vinegar 385mL', barcode: '4800016646791', category_id: pantry, unit: 'bottle', cost_price: 16, selling_price: 24, stock_quantity: 18, reorder_level: 6 },
    { name: 'Brown Sugar 500g', barcode: '4800016646792', category_id: pantry, unit: 'pack', cost_price: 32, selling_price: 45, stock_quantity: 3, reorder_level: 6 },
  ];

  const products = [];
  for (const def of productDefs) {
    products.push(await upsertProduct(def));
  }

  // Seed realistic sales across the past 14 days (idempotent by receipt_no)
  const rand = mulberry32(20261121);
  const cashiers = [cashier1Id, cashier2Id];
  let insertedSales = 0;

  // Daily transaction counts (more lively on recent days & weekends)
  const dailyCounts = [3, 4, 3, 5, 4, 3, 4, 5, 6, 4, 7, 8, 6, 7]; // 14 days ending today

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const count = dailyCounts[13 - dayOffset];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - dayOffset);
    const ymd = baseDate.toISOString().slice(0, 10).replace(/-/g, '');

    for (let seq = 1; seq <= count; seq++) {
      const receiptNo = `SEED-${ymd}-${String(seq).padStart(3, '0')}`;
      const existing = await query('SELECT id FROM sales WHERE receipt_no = $1', [receiptNo]);
      if (existing.rows.length) continue;

      const hour = 7 + Math.floor(rand() * 13); // 7am - 7pm
      const minute = Math.floor(rand() * 60);
      const saleTime = new Date(baseDate);
      saleTime.setHours(hour, minute, Math.floor(rand() * 60), 0);
      if (saleTime > new Date()) saleTime.setTime(Date.now() - Math.floor(rand() * 3600000));

      const itemCount = 2 + Math.floor(rand() * 4); // 2 to 5 distinct items
      const chosen = new Map();
      for (let k = 0; k < itemCount; k++) {
        const prod = products[Math.floor(rand() * products.length)];
        const qty = 1 + Math.floor(rand() * 4);
        chosen.set(prod.id, { prod, qty: (chosen.get(prod.id)?.qty || 0) + qty });
      }

      let total = 0;
      const lineItems = [];
      for (const { prod, qty } of chosen.values()) {
        const unitPrice = Number(prod.selling_price);
        const subtotal = unitPrice * qty;
        total += subtotal;
        lineItems.push({ product_id: prod.id, product_name: prod.name, unit_price: unitPrice, quantity: qty, subtotal });
      }

      const cashBills = [20, 50, 100, 200, 500, 1000];
      const paid = cashBills.find((b) => b >= total) || Math.ceil(total / 100) * 100;
      const change = paid - total;
      const userId = cashiers[Math.floor(rand() * cashiers.length)];

      const saleRes = await query(
        `INSERT INTO sales (receipt_no, user_id, total_amount, amount_paid, change_amount, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [receiptNo, userId, total, paid, change, saleTime.toISOString()]
      );
      const saleId = saleRes.rows[0].id;

      for (const li of lineItems) {
        await query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [saleId, li.product_id, li.product_name, li.unit_price, li.quantity, li.subtotal]
        );
      }
      insertedSales += 1;
    }
  }

  // Seed inventory reports if table is currently empty
  const { rows: reportCountRows } = await query('SELECT COUNT(*)::int AS cnt FROM inventory_reports');
  let insertedReports = 0;
  if (reportCountRows[0].cnt === 0) {
    const sampleReports = [
      { idx: 0, type: 'restock', qty: 30, note: 'Weekly supplier delivery', daysAgo: 12, user: cashier1Id },
      { idx: 1, type: 'restock', qty: 24, note: 'Morning restock from bodega', daysAgo: 11, user: cashier2Id },
      { idx: 5, type: 'damaged', qty: -2, note: 'Dented cans during unpacking', daysAgo: 10, user: cashier1Id },
      { idx: 9, type: 'restock', qty: 18, note: 'Soft drinks crate delivery', daysAgo: 9, user: cashier2Id },
      { idx: 10, type: 'restock', qty: 48, note: '2 cases bottled water', daysAgo: 8, user: cashier1Id },
      { idx: 4, type: 'lost', qty: -3, note: 'Missing during evening count', daysAgo: 7, user: cashier2Id },
      { idx: 11, type: 'restock', qty: 50, note: 'Coffee sachet bundle', daysAgo: 6, user: cashier1Id },
      { idx: 7, type: 'correction', qty: -1, note: 'Shelf audit adjustment', daysAgo: 5, user: adminId },
      { idx: 15, type: 'restock', qty: 20, note: 'Household restock', daysAgo: 4, user: cashier2Id },
      { idx: 20, type: 'restock', qty: 40, note: 'Shampoo hanger pack', daysAgo: 3, user: cashier1Id },
      { idx: 22, type: 'damaged', qty: -1, note: 'Leaking oil bottle cap', daysAgo: 2, user: cashier2Id },
      { idx: 25, type: 'correction', qty: -2, note: 'Repacking variance', daysAgo: 1, user: cashier1Id },
      { idx: 12, type: 'restock', qty: 24, note: 'Cold drinks refill', daysAgo: 1, user: cashier2Id },
      { idx: 16, type: 'restock', qty: 36, note: 'Detergent tie delivery', daysAgo: 0, user: cashier1Id },
    ];

    for (const r of sampleReports) {
      const prod = products[r.idx % products.length];
      const dt = new Date();
      dt.setDate(dt.getDate() - r.daysAgo);
      dt.setHours(9 + (r.idx % 8), 15, 0, 0);
      await query(
        `INSERT INTO inventory_reports (user_id, product_id, type, quantity_change, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.user, prod.id, r.type, r.qty, r.note, dt.toISOString()]
      );
      insertedReports += 1;
    }
  }

  console.log(`Seed complete. Products: ${products.length}, New sales: ${insertedSales}, New reports: ${insertedReports}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
