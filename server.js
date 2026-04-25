const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' })); 

const MONGO_URI = "mongodb+srv://karimlaham232_db_user:karim.1234@cluster0.rcrmtnz.mongodb.net/syriacare?retryWrites=true&w=majority";

// ==========================================
// SCHEMAS (Database Structure)
// ==========================================
const productSchema = new mongoose.Schema({
    id: String, name: String, category: String, store: String, image: String, priceUSD: Number, originalTRY: Number, description: String 
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    name: String, surname: String, phone: String, location: String, items: Array, total: Number, status: { type: String, default: 'Pending' }, date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// 🟢 NEW: User Account Schema
const userSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    address: String,
    password: String,
    date: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// ==========================================
// API ROUTES
// ==========================================

app.get('/ping', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send('Server and Database are both awake! 🚀');
    } catch (error) { res.status(500).send('Database connection error'); }
});

// --- PRODUCT ROUTES ---
let cachedProducts = null;
let lastCacheTime = null;
let isFetching = false;

app.get('/api/products', async (req, res) => {
    try {
        if (cachedProducts && lastCacheTime > Date.now() - 300000) return res.json(cachedProducts);
        if (isFetching) return res.status(503).json({ message: "Server is syncing data..." });

        isFetching = true;
        const products = await Product.find({}).lean();
        
        cachedProducts = products;
        lastCacheTime = Date.now();
        isFetching = false;
        
        res.json(products);
    } catch (err) {
        isFetching = false;
        res.status(500).json({ message: "Error fetching products" });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        if (cachedProducts) cachedProducts.push(newProduct.toObject());
        res.json({ message: "Product saved!", product: newProduct });
    } catch (err) { res.status(500).json({ message: "Error saving product" }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { id: id }] } : { id: id };
        const updatedProduct = await Product.findOneAndUpdate(query, { $set: req.body }, { new: true });
        cachedProducts = null; 
        res.json({ success: true, product: updatedProduct });
    } catch (error) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const query = mongoose.Types.ObjectId.isValid(req.params.id) ? { $or: [{ _id: req.params.id }, { id: req.params.id }] } : { id: req.params.id };
        await Product.deleteOne(query);
        cachedProducts = null; 
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Delete failed" }); }
});

// --- ORDER ROUTES ---
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

// 🟢 NEW: USER ACCOUNTS ROUTES
app.post('/api/users/register', async (req, res) => {
    try {
        // Check if phone number is already registered
        const existingUser = await User.findOne({ phone: req.body.phone }).lean();
        if (existingUser) {
            return res.status(400).json({ error: "Phone number is already registered." });
        }
        
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (err) { res.status(500).json({ error: "Registration failed." }); }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.body.phone, password: req.body.password }).lean();
        if (!user) {
            return res.status(401).json({ error: "Invalid phone number or password." });
        }
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ error: "Login failed." }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ date: -1 }).select('-password').lean();
        res.json(users);
    } catch (err) { res.status(500).json({ error: "Failed to fetch users." }); }
});

// ==========================================
// CONNECT AND START
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("🟢 Connected to MongoDB Atlas!");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
    })
    .catch(err => console.error("🔴 Connection Error:", err));