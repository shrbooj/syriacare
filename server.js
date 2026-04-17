const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.static(__dirname));

// FIX 1: Increased limit to 50mb so PC images don't crash the server!
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    description: String // Added description so it saves properly!
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    location: String,
    items: Array,
    total: Number,
    status: { type: String, default: 'Pending' }, // Required for Admin dropdown
    createdAt: { type: Date, default: Date.now }, // Required for sorting
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

// FIX 2: UPDATE product using MongoDB's true _id
app.put('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            { $set: req.body },
            { new: true }
        );
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: "Failed to update" });
    }
});

// FIX 3: DELETE product using MongoDB's true _id
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
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
        const orders = await Order.find().sort({ createdAt: -1, date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// FIX 4: UPDATE Order Status (Triggered by Admin Dropdown)
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        res.status(500).json({ error: "Failed to update order status" });
    }
});

// FIX 5: GET Orders by Phone Number (For the User's "My Orders" tab)
app.get('/api/orders/phone/:phone', async (req, res) => {
    try {
        const orders = await Order.find({ phone: req.params.phone }).sort({ createdAt: -1, date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user orders" });
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