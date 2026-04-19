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
    id: String, // Changed to String to match your Date.now().toString() logic
    name: String,
    category: String,
    store: String,
    image: String,
    priceUSD: Number,
    originalTRY: Number
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    location: String,
    items: Array,
    total: Number,
    status: { type: String, default: 'Pending' }, // 🟢 ADDED: Tracks the order status
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ==========================================
// API ROUTES
// ==========================================

// GET all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Error fetching products" });
    }
});

// POST new product
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ message: "Product saved!", product: newProduct });
    } catch (err) {
        res.status(500).json({ message: "Error saving product" });
    }
});

// UPDATE product
app.put('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { id: req.params.id },
            { $set: req.body },
            { new: true }
        );
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: "Failed to update" });
    }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.deleteOne({ id: req.params.id });
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

// GET all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// 🟢 ADDED: UPDATE order status route
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
        console.log("🟢 SUCCESS: Connected to MongoDB Atlas!");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("🔴 CLOUD ERROR:", err);
    });