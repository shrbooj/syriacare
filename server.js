const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); // This allows your HTML files to talk to this server securely
app.use('/images', express.static('images'));
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' })); // This allows massive image uploads!

// YOUR DATABASE KEY
const MONGO_URI = "mongodb+srv://karimlaham232_db_user:karim.1234@cluster0.rcrmtnz.mongodb.net/?appName=Cluster0";

// Tell Mongoose what a Product looks like
const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    category: String,
    store: String,
    image: String,
    priceUSD: Number,
    originalTRY: Number
});

const Product = mongoose.model('Product', productSchema);

// ==========================================
// THE API ROUTES (The Bridge to your HTML)
// ==========================================

// 1. GET: Send all products to the Storefront
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Error fetching products" });
    }
});

// 2. POST: Receive a new product from the Admin panel
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ message: "Product saved to cloud!", product: newProduct });
    } catch (err) {
        res.status(500).json({ message: "Error saving product" });
    }
});

// 3. DELETE: Remove a product from the Admin panel
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.deleteOne({ id: req.params.id });
        res.json({ message: "Product deleted from cloud!" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting product" });
    }
});

// ==========================================
// TURN ON THE SERVER
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ Connected to MongoDB Atlas!");
        // ==========================================
// ORDER DATABASE VAULT
// ==========================================
const orderSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    location: String,
    items: Array,
    total: Number,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Receive Orders from the Checkout Page
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.json({ success: true, order: newOrder });
    } catch (error) {
        res.status(500).json({ error: "Failed to save order" });
    }
});

// Send Orders to the Admin Dashboard
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 }); // Shows newest orders first
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});
// DELETE a product from the database
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
    }
});
// UPDATE a product in the database
app.put('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { id: req.params.id },
            { $set: req.body }, // This overwrites the old details with the new ones
            { new: true }
        );
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: "Failed to update product" });
    }
});
        app.listen(5000, () => {
            console.log("🚀 Server is running on http://localhost:5000");
        });
    })
    .catch(err => console.error("❌ Database connection error:", err));