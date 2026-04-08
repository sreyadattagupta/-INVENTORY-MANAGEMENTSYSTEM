/**
 * INVENTORY STACK MANAGEMENT — PORT 3000
 * Database: MongoDB (Document Store / Unstructured DB)
 *
 * WHY MONGODB?
 * Products in an inventory are schema-flexible — a laptop has a CPU,
 * a shirt has a size. A relational DB forces a rigid schema; MongoDB
 * stores each product as a BSON document, naturally accommodating
 * heterogeneous product types without migrations.
 * - Rich document queries (filter by nested fields)
 * - Horizontal sharding for large catalogues
 * - JSON-native, matches REST API payloads directly
 *
 * ROUTES:
 *  POST   /inventory            — add product
 *  GET    /inventory            — view all products
 *  GET    /inventory/:id        — view by ID
 *  PUT    /inventory/:id        — update product
 *  DELETE /inventory/:id        — delete product
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED MONGODB COLLECTION (in-memory Map for demo)
// In production:
//   const { MongoClient } = require('mongodb');
//   const client = new MongoClient('mongodb://localhost:27017');
//   const db = client.db('inventory_db');
//   const products = db.collection('products');
// ─────────────────────────────────────────────────────────────────────────────

const mongoCollection = new Map(); // { _id -> document }

function insertOne(doc) {
  const _id = doc._id || uuidv4();
  const document = { ...doc, _id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  mongoCollection.set(_id, document);
  return document;
}

function findAll(filter = {}) {
  const docs = Array.from(mongoCollection.values());
  // Simple key-value filter simulation
  return docs.filter(doc =>
    Object.entries(filter).every(([k, v]) => doc[k] === v)
  );
}

function findById(id) {
  return mongoCollection.get(id) || null;
}

function updateById(id, update) {
  const existing = mongoCollection.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...update, _id: id, updatedAt: new Date().toISOString() };
  mongoCollection.set(id, updated);
  return updated;
}

function deleteById(id) {
  const existing = mongoCollection.get(id);
  if (!existing) return false;
  mongoCollection.delete(id);
  return true;
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
insertOne({
  name: 'Laptop Pro 15',
  category: 'Electronics',
  manufacturer: 'TechCorp',
  price: 1299.99,
  stock: 42,
  specs: { cpu: 'Intel i7', ram: '16GB', storage: '512GB SSD' }
});
insertOne({
  name: 'Wireless Mouse',
  category: 'Electronics',
  manufacturer: 'PeriphCo',
  price: 29.99,
  stock: 150,
  specs: { dpi: 1600, connectivity: 'Bluetooth' }
});
insertOne({
  name: 'Office Chair Ergo',
  category: 'Furniture',
  manufacturer: 'ComfortMakers',
  price: 499.00,
  stock: 18,
  specs: { material: 'Mesh', adjustable: true, weightCapacity: '120kg' }
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    service: 'Inventory Stack Management',
    database: 'MongoDB (Document Store)',
    port: 3000,
    endpoints: [
      'POST   /inventory         — add a product',
      'GET    /inventory         — list all products',
      'GET    /inventory/:id     — get product by ID',
      'PUT    /inventory/:id     — update product',
      'DELETE /inventory/:id     — delete product',
      'GET    /inventory/stats   — inventory statistics',
    ],
  });
});

// ── ADD product ──────────────────────────────────────────────────────────────
app.post('/inventory', (req, res) => {
  const { name, category, manufacturer, price, stock, specs } = req.body;
  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'name, price, and stock are required' });
  }

  const doc = insertOne({ name, category, manufacturer, price, stock, specs: specs || {} });
  res.status(201).json({
    message: 'Product added to MongoDB inventory',
    product: doc,
    db: 'MongoDB',
    operation: 'insertOne',
  });
});

// ── VIEW ALL ─────────────────────────────────────────────────────────────────
app.get('/inventory', (req, res) => {
  const { category, manufacturer } = req.query;
  const filter = {};
  if (category)     filter.category     = category;
  if (manufacturer) filter.manufacturer = manufacturer;

  const products = findAll(filter);
  res.json({
    count: products.length,
    filter: Object.keys(filter).length ? filter : 'none',
    products,
    db: 'MongoDB',
    operation: 'find({})',
  });
});

// ── VIEW BY ID ───────────────────────────────────────────────────────────────
app.get('/inventory/stats', (req, res) => {
  const all = findAll();
  const totalValue = all.reduce((s, p) => s + (p.price * p.stock), 0);
  const byCategory = all.reduce((acc, p) => {
    acc[p.category || 'Uncategorized'] = (acc[p.category || 'Uncategorized'] || 0) + 1;
    return acc;
  }, {});
  res.json({
    totalProducts: all.length,
    totalInventoryValue: `$${totalValue.toFixed(2)}`,
    byCategory,
    db: 'MongoDB aggregation pipeline',
  });
});

app.get('/inventory/:id', (req, res) => {
  const product = findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found', id: req.params.id });
  res.json({ product, db: 'MongoDB', operation: 'findOne({ _id })' });
});

// ── UPDATE ───────────────────────────────────────────────────────────────────
app.put('/inventory/:id', (req, res) => {
  const updated = updateById(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found', id: req.params.id });
  res.json({
    message: 'Product updated',
    product: updated,
    db: 'MongoDB',
    operation: 'updateOne({ _id }, { $set: ... })',
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────
app.delete('/inventory/:id', (req, res) => {
  const deleted = deleteById(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found', id: req.params.id });
  res.json({
    message: 'Product deleted from inventory',
    id: req.params.id,
    db: 'MongoDB',
    operation: 'deleteOne({ _id })',
  });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🍃 MongoDB Inventory API running on http://localhost:${PORT}`);
  console.log(`   DB     : MongoDB (Document Store)`);
  console.log(`   Seeded : 3 sample products\n`);
});
