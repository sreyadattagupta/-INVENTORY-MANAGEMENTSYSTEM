/**
 * PRODUCT-MANUFACTURER CORRELATION — PORT 4000
 * Database: Neo4j (Graph Database)
 *
 * WHY NEO4J?
 * The relationship between products, manufacturers, suppliers, and
 * categories is a GRAPH problem — not a flat table problem.
 * Neo4j stores data as nodes + edges, allowing:
 * - "Which manufacturers share components with a competitor?"
 * - "What is the supply chain path for product X?"
 * - "Find all products 2 hops from manufacturer Y"
 * These multi-hop traversals are O(relationship) in Neo4j vs
 * expensive multi-JOIN queries in SQL or MongoDB.
 *
 * NODE TYPES:    Product, Manufacturer, Category, Region
 * RELATIONSHIPS: MANUFACTURED_BY, SUPPLIES, BELONGS_TO, LOCATED_IN
 *
 * ROUTES:
 *  GET  /graph             — full graph overview
 *  GET  /graph/products    — all product nodes
 *  GET  /graph/manufacturers — all manufacturer nodes
 *  GET  /graph/product/:id — product + its relationships
 *  GET  /graph/manufacturer/:id — manufacturer + all their products
 *  POST /graph/product     — add product node
 *  POST /graph/link        — create relationship between nodes
 *  GET  /graph/path/:from/:to — find path between two nodes
 *  GET  /graph/cypher      — example Cypher queries
 */

const express = require('express');
const app = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED NEO4J GRAPH STORE (adjacency list for demo)
// In production:
//   const neo4j = require('neo4j-driver');
//   const driver = neo4j.driver('bolt://localhost:7687',
//                  neo4j.auth.basic('neo4j', 'password'));
//   const session = driver.session();
//   await session.run(`MATCH (p:Product)-[:MANUFACTURED_BY]->(m:Manufacturer) RETURN p, m`);
// ─────────────────────────────────────────────────────────────────────────────

let nodeIdCounter = 1;
const nodes = new Map();       // id -> { id, label, properties }
const relationships = new Map(); // id -> { id, from, to, type, properties }
let relIdCounter = 1;

function createNode(label, properties) {
  const id = `n${nodeIdCounter++}`;
  const node = { id, label, properties: { ...properties, id } };
  nodes.set(id, node);
  return node;
}

function createRelationship(fromId, toId, type, properties = {}) {
  const id = `r${relIdCounter++}`;
  const rel = { id, from: fromId, to: toId, type, properties };
  relationships.set(id, rel);
  return rel;
}

function getNodeRelationships(nodeId) {
  const rels = [];
  for (const rel of relationships.values()) {
    if (rel.from === nodeId || rel.to === nodeId) {
      rels.push({
        ...rel,
        fromNode: nodes.get(rel.from),
        toNode:   nodes.get(rel.to),
      });
    }
  }
  return rels;
}

function bfsPath(startId, endId) {
  const visited = new Set([startId]);
  const queue   = [[startId]];

  while (queue.length > 0) {
    const path = queue.shift();
    const curr = path[path.length - 1];

    if (curr === endId) {
      return path.map(id => nodes.get(id));
    }

    for (const rel of relationships.values()) {
      const next = rel.from === curr ? rel.to : (rel.to === curr ? rel.from : null);
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

// ─── SEED NEO4J GRAPH ─────────────────────────────────────────────────────────

// Regions
const regionUS   = createNode('Region',  { name: 'North America', code: 'NA' });
const regionEU   = createNode('Region',  { name: 'Europe', code: 'EU' });
const regionAS   = createNode('Region',  { name: 'Asia Pacific', code: 'APAC' });

// Manufacturers
const mfgTech    = createNode('Manufacturer', { name: 'TechCorp', founded: 2001, revenue: '5B' });
const mfgPeriph  = createNode('Manufacturer', { name: 'PeriphCo', founded: 2010, revenue: '800M' });
const mfgComfort = createNode('Manufacturer', { name: 'ComfortMakers', founded: 1995, revenue: '1.2B' });
const mfgChip    = createNode('Manufacturer', { name: 'ChipMakers Inc', founded: 1988, revenue: '20B' });

// Categories
const catElec    = createNode('Category', { name: 'Electronics', taxCode: 'ELEC' });
const catFurni   = createNode('Category', { name: 'Furniture', taxCode: 'FURN' });

// Products
const prodLaptop = createNode('Product', { name: 'Laptop Pro 15', price: 1299.99, sku: 'LP-001' });
const prodMouse  = createNode('Product', { name: 'Wireless Mouse', price: 29.99,  sku: 'WM-002' });
const prodChair  = createNode('Product', { name: 'Office Chair Ergo', price: 499.00, sku: 'OC-003' });
const prodTablet = createNode('Product', { name: 'Tablet X', price: 599.99, sku: 'TX-004' });

// ── Relationships (the Graph Edges) ─────────────────────────────────────────

// Products MANUFACTURED_BY Manufacturers
createRelationship(prodLaptop.id, mfgTech.id,    'MANUFACTURED_BY', { contract: '2022-A' });
createRelationship(prodMouse.id,  mfgPeriph.id,  'MANUFACTURED_BY', { contract: '2021-B' });
createRelationship(prodChair.id,  mfgComfort.id, 'MANUFACTURED_BY', { contract: '2020-C' });
createRelationship(prodTablet.id, mfgTech.id,    'MANUFACTURED_BY', { contract: '2023-D' });

// Manufacturers SUPPLIES components to other Manufacturers
createRelationship(mfgChip.id, mfgTech.id,   'SUPPLIES', { component: 'CPU Chips', since: '2018' });
createRelationship(mfgChip.id, mfgPeriph.id, 'SUPPLIES', { component: 'Micro-controllers', since: '2019' });

// Products BELONGS_TO Category
createRelationship(prodLaptop.id, catElec.id,  'BELONGS_TO', {});
createRelationship(prodMouse.id,  catElec.id,  'BELONGS_TO', {});
createRelationship(prodChair.id,  catFurni.id, 'BELONGS_TO', {});
createRelationship(prodTablet.id, catElec.id,  'BELONGS_TO', {});

// Manufacturers LOCATED_IN Region
createRelationship(mfgTech.id,    regionUS.id, 'LOCATED_IN', {});
createRelationship(mfgPeriph.id,  regionEU.id, 'LOCATED_IN', {});
createRelationship(mfgComfort.id, regionEU.id, 'LOCATED_IN', {});
createRelationship(mfgChip.id,    regionAS.id, 'LOCATED_IN', {});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    service: 'Product-Manufacturer Graph Correlation',
    database: 'Neo4j (Graph Database)',
    port: 4000,
    totalNodes: nodes.size,
    totalRelationships: relationships.size,
    nodeTypes: ['Product', 'Manufacturer', 'Category', 'Region'],
    relationshipTypes: ['MANUFACTURED_BY', 'SUPPLIES', 'BELONGS_TO', 'LOCATED_IN'],
    endpoints: [
      'GET  /graph              — overview',
      'GET  /graph/nodes        — all nodes',
      'GET  /graph/products     — product nodes',
      'GET  /graph/manufacturers — manufacturer nodes',
      'GET  /graph/product/:id  — product with all relationships',
      'GET  /graph/manufacturer/:id — manufacturer with all products',
      'POST /graph/product      — add product node',
      'POST /graph/link         — create relationship',
      'GET  /graph/path/:from/:to — shortest path',
      'GET  /graph/cypher       — Cypher query examples',
    ],
  });
});

// Full graph
app.get('/graph', (req, res) => {
  res.json({
    nodes: Array.from(nodes.values()),
    relationships: Array.from(relationships.values()).map(r => ({
      ...r, fromNode: nodes.get(r.from)?.properties?.name,
      toNode: nodes.get(r.to)?.properties?.name,
    })),
    db: 'Neo4j',
    cypherEquivalent: 'MATCH (n)-[r]->(m) RETURN n, r, m',
  });
});

// All nodes
app.get('/graph/nodes', (req, res) => {
  const { label } = req.query;
  let result = Array.from(nodes.values());
  if (label) result = result.filter(n => n.label === label);
  res.json({ count: result.length, nodes: result });
});

// Products only
app.get('/graph/products', (req, res) => {
  const products = Array.from(nodes.values()).filter(n => n.label === 'Product');
  res.json({
    count: products.length,
    products,
    db: 'Neo4j',
    cypherEquivalent: 'MATCH (p:Product) RETURN p',
  });
});

// Manufacturers only
app.get('/graph/manufacturers', (req, res) => {
  const mfgs = Array.from(nodes.values()).filter(n => n.label === 'Manufacturer');
  res.json({
    count: mfgs.length,
    manufacturers: mfgs,
    db: 'Neo4j',
    cypherEquivalent: 'MATCH (m:Manufacturer) RETURN m',
  });
});

// Product + relationships
app.get('/graph/product/:id', (req, res) => {
  const node = nodes.get(req.params.id);
  if (!node || node.label !== 'Product') {
    return res.status(404).json({ error: 'Product node not found' });
  }
  const rels = getNodeRelationships(req.params.id);
  res.json({
    product: node,
    relationships: rels,
    db: 'Neo4j',
    cypherEquivalent: `MATCH (p:Product {id:'${req.params.id}'})-[r]->(n) RETURN p, r, n`,
  });
});

// Manufacturer + all products
app.get('/graph/manufacturer/:id', (req, res) => {
  const node = nodes.get(req.params.id);
  if (!node || node.label !== 'Manufacturer') {
    return res.status(404).json({ error: 'Manufacturer node not found' });
  }
  const allRels  = getNodeRelationships(req.params.id);
  const products = allRels
    .filter(r => r.type === 'MANUFACTURED_BY' && r.to === req.params.id)
    .map(r => r.fromNode);
  const suppliers = allRels
    .filter(r => r.type === 'SUPPLIES' && r.to === req.params.id)
    .map(r => ({ supplier: r.fromNode, component: r.properties.component }));

  res.json({
    manufacturer: node,
    products,
    suppliers,
    allRelationships: allRels,
    db: 'Neo4j',
    cypherEquivalent: `MATCH (p:Product)-[:MANUFACTURED_BY]->(m:Manufacturer {id:'${req.params.id}'}) RETURN p, m`,
  });
});

// Add product node
app.post('/graph/product', (req, res) => {
  const { name, price, sku, manufacturerId, categoryId } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const node = createNode('Product', { name, price, sku });
  const createdRels = [];

  if (manufacturerId && nodes.has(manufacturerId)) {
    createdRels.push(createRelationship(node.id, manufacturerId, 'MANUFACTURED_BY', {}));
  }
  if (categoryId && nodes.has(categoryId)) {
    createdRels.push(createRelationship(node.id, categoryId, 'BELONGS_TO', {}));
  }

  res.status(201).json({
    message: 'Product node created in Neo4j',
    node,
    relationshipsCreated: createdRels,
    db: 'Neo4j',
    cypherEquivalent: `CREATE (p:Product {name:'${name}'}) RETURN p`,
  });
});

// Create relationship
app.post('/graph/link', (req, res) => {
  const { fromId, toId, type, properties } = req.body;
  if (!fromId || !toId || !type) {
    return res.status(400).json({ error: 'fromId, toId, and type are required' });
  }
  if (!nodes.has(fromId) || !nodes.has(toId)) {
    return res.status(404).json({ error: 'One or both nodes not found' });
  }

  const rel = createRelationship(fromId, toId, type, properties || {});
  res.status(201).json({
    message: 'Relationship created',
    relationship: {
      ...rel,
      fromNode: nodes.get(fromId),
      toNode:   nodes.get(toId),
    },
    db: 'Neo4j',
    cypherEquivalent: `MATCH (a {id:'${fromId}'}), (b {id:'${toId}'}) CREATE (a)-[:${type}]->(b)`,
  });
});

// Shortest path between nodes
app.get('/graph/path/:from/:to', (req, res) => {
  const { from, to } = req.params;
  if (!nodes.has(from) || !nodes.has(to)) {
    return res.status(404).json({ error: 'One or both nodes not found' });
  }

  const path = bfsPath(from, to);
  if (!path) {
    return res.json({ message: 'No path found', from: nodes.get(from), to: nodes.get(to) });
  }

  res.json({
    path,
    hops: path.length - 1,
    db: 'Neo4j',
    cypherEquivalent: `MATCH p=shortestPath((a {id:'${from}'})-[*]-(b {id:'${to}'})) RETURN p`,
  });
});

// Cypher examples
app.get('/graph/cypher', (req, res) => {
  res.json({
    description: 'Example Cypher queries for this graph (Neo4j query language)',
    queries: [
      { label: 'All products and their manufacturers',
        cypher: 'MATCH (p:Product)-[:MANUFACTURED_BY]->(m:Manufacturer) RETURN p.name, m.name' },
      { label: 'Manufacturers in Europe',
        cypher: "MATCH (m:Manufacturer)-[:LOCATED_IN]->(r:Region {name:'Europe'}) RETURN m" },
      { label: 'Supply chain: who supplies TechCorp?',
        cypher: "MATCH (s:Manufacturer)-[:SUPPLIES]->(m:Manufacturer {name:'TechCorp'}) RETURN s" },
      { label: 'Products 2 hops from ChipMakers',
        cypher: 'MATCH (c:Manufacturer {name:"ChipMakers Inc"})-[*1..2]-(p:Product) RETURN p' },
      { label: 'Full supply chain path (Cypher shortestPath)',
        cypher: "MATCH path=shortestPath((p:Product)-[*]-(r:Region)) RETURN path" },
    ],
    note: 'Run these in the Neo4j Browser at http://localhost:7474',
  });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\n🔵 Neo4j Graph Correlation running on http://localhost:${PORT}`);
  console.log(`   DB     : Neo4j (Graph Database)`);
  console.log(`   Nodes  : ${nodes.size}, Relationships: ${relationships.size}\n`);
});
