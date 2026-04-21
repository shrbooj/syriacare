const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' })); 

/// Cloud Database URI
const MONGO_URI = "mongodb+srv://karimlaham232_db_user:karim.1234@cluster0.rcrmtnz.mongodb.net/syriacare?retryWrites=true&w=majority";

// ==========================================
// SCHEMAS
// ==========================================
const productSchema = new mongoose.Schema({
    id: String, 
    name: String,
    category: String,
    store: String,
    image: String,
    priceUSD: Number,
    originalTRY: Number,
    description: String 
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    location: String,
    items: Array,
    total: Number,
    status: { type: String, default: 'Pending' }, 
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ==========================================
// API ROUTES
// ==========================================

// 🟢 PING ROUTE: Keeps Server and DB awake
app.get('/ping', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send('Alive! 🚀');
    } catch (error) {
        res.status(500).send('DB Error');
    }
});

// 🟢 SMART RAM CACHE
let cachedProducts = null;
let lastCacheTime = null;
let isFetching = false;

// GET all products (Instant from RAM)
app.get('/api/products', async (req, res) => {
    try {
        if (cachedProducts && lastCacheTime > Date.now() - 300000) {
            console.log("⚡ RAM CACHE: Serving products instantly.");
            return res.json(cachedProducts);
        }

        if (isFetching) {
            console.log("⚠️ BUSY: Fetch already in progress.");
            return res.status(503).json({ message: "Syncing... please refresh in 5 seconds." });
        }

        isFetching = true;
        console.log("🐢 DATABASE: Initial fetch started...");
        console.time("⏱️ DB_Fetch");

        const products = await Product.find({}).lean();
        
        console.timeEnd("⏱️ DB_Fetch");

        cachedProducts = products;
        lastCacheTime = Date.now();
        isFetching = false;
        
        res.json(products);
    } catch (err) {
        isFetching = false;
        res.status(500).json({ message: "Error fetching data" });
    }
});

// 🟢 POST new product (Smart Cache: Updates memory without refetching)
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();

        // Manually update the cache in memory so we don't have to fetch 130MB again
        if (cachedProducts) {
            cachedProducts.push(newProduct.toObject());
            console.log("✅ CACHE: Manually appended new product.");
        }

        res.json({ message: "Product saved!", product: newProduct });
    } catch (err) {
        res.status(500).json({ message: "Error saving product" });
    }
});

// UPDATE product
app.put('/api/products/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { id: id }] } : { id: id };
        const updatedProduct = await Product.findOneAndUpdate(query, { $set: req.body }, { new: true });
        
        cachedProducts = null; // Forces a single fresh fetch for accuracy
        res.json({ success: true, product: updatedProduct });
    } catch (error) { res.status(500).json({ error: "Update failed" }); }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const query = mongoose.Types.ObjectId.isValid(req.params.id) ? { $or: [{ _id: req.params.id }, { id: req.params.id }] } : { id: req.params.id };
        await Product.deleteOne(query);
        cachedProducts = null; // Forces a fresh fetch
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Delete failed" }); }
});

// ==========================================
// ORDER ROUTES
// ==========================================

app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.json({ success: true, order: newOrder });
    } catch (error) { res.status(500).json({ error: "Order failed" }); }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 }).lean();
        res.json(orders);
    } catch (error) { res.status(500).json({ error: "Fetch failed" }); }
});

app.get('/api/orders/phone/:phone', async (req, res) => {
    try {
        const userOrders = await Order.find({ phone: req.params.phone }).sort({ date: -1 }).lean();
        res.json(userOrders);
    } catch (error) { res.status(500).json({ error: "User fetch failed" }); }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
        res.json({ success: true, order: updatedOrder });
    } catch (error) { res.status(500).json({ error: "Status update failed" }); }
});

// ==========================================
// CONNECT AND START
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("🟢 Connected to Atlas!");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
    })
    .catch(err => console.error("🔴 Connection Error:", err));