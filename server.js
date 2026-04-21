const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' })); 

/// This is your unique cloud key
const MONGO_URI = "mongodb+srv://karimlaham232_db_user:karim.1234@cluster0.rcrmtnz.mongodb.net/syriacare?retryWrites=true&w=majority";

// ==========================================
// SCHEMAS (Database Structure)
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

// 🟢 LIGHTWEIGHT PING ROUTE: Keeps Server and Database awake
app.get('/ping', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send('Server and Database are both awake! 🚀');
    } catch (error) {
        res.status(500).send('Server is awake, but Database failed to ping.');
    }
});

// 🟢 RAM CACHE VARIABLES
let cachedProducts = null;
let lastCacheTime = null;

// GET all products (Optimized with .lean() and 5-minute RAM Cache)
app.get('/api/products', async (req, res) => {
    try {
        // 1. Check RAM Cache (Instant)
        if (cachedProducts && lastCacheTime > Date.now() - 300000) {
            console.log("⚡ RAM CACHE: Serving products instantly.");
            return res.json(cachedProducts);
        }

        // 2. Otherwise, pull from MongoDB
        console.log("🐢 DATABASE: Fetching started...");
        console.time("⏱️ DB_Fetch_Duration"); // Starts a timer in your logs

        // .lean() makes the query significantly faster by returning raw JSON instead of heavy Mongoose documents
        const products = await Product.find({}).lean();
        
        console.timeEnd("⏱️ DB_Fetch_Duration"); // Tells you exactly how long it took

        // 3. Save to memory for the next 5 minutes
        cachedProducts = products;
        lastCacheTime = Date.now();
        
        res.json(products);
    } catch (err) {
        console.error("❌ ERROR fetching products:", err);
        res.status(500).json({ message: "Error fetching products" });
    }
});

// POST new product
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        // Clear cache so new product shows up immediately
        cachedProducts = null; 
        res.json({ message: "Product saved!", product: newProduct });
    } catch (err) {
        res.status(500).json({ message: "Error saving product" });
    }
});

// UPDATE product
app.put('/api/products/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = mongoose.Types.ObjectId.isValid(id) 
            ? { $or: [{ _id: id }, { id: id }] } 
            : { id: id };

        const updatedProduct = await Product.findOneAndUpdate(
            query,
            { $set: req.body },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: "Product not found." });
        }

        cachedProducts = null; // Clear cache
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: "Failed to update product" });
    }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const query = mongoose.Types.ObjectId.isValid(req.params.id) 
            ? { $or: [{ _id: req.params.id }, { id: req.params.id }] } 
            : { id: req.params.id };

        await Product.deleteOne(query);
        cachedProducts = null; // Clear cache
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

// POST new order
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.json({ success: true, order: newOrder });
    } catch (error) {
        res.status(500).json({ error: "Failed to save order" });
    }
});

// GET all orders (Optimized with .lean())
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 }).lean();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// GET orders by phone (Optimized with .lean())
app.get('/api/orders/phone/:phone', async (req, res) => {
    try {
        const userOrders = await Order.find({ phone: req.params.phone }).sort({ date: -1 }).lean();
        res.json(userOrders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user orders" });
    }
});

// UPDATE order status 
app.put('/api/orders/:id', async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: { status: req.body.status } },
            { new: true }
        );
        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        res.status(500).json({ error: "Failed to update order status" });
    }
});

// ==========================================
// CONNECT AND START
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("🟢 Connected to MongoDB Atlas!");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("🔴 CLOUD ERROR:", err);
    });