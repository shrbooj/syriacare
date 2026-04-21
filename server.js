const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.json({ limit: '10mb' })); 

// Note: Your password is in here! It works, but be careful sharing this file.
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
// HEALTH CHECK (For UptimeRobot)
// ==========================================
app.get('/api/health', (req, res) => {
    res.status(200).send('Server is awake!');
});

// ==========================================
// PRODUCT ROUTES
// ==========================================
app.get('/api/products', async (req, res) => {
    try { res.json(await Product.find({})); }
    catch (err) { res.status(500).json({ message: "Error fetching products" }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ message: "Product saved!", product: newProduct });
    } catch (err) { res.status(500).json({ message: "Error saving product" }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
        const query = isValidObjectId ? { _id: req.params.id } : { id: req.params.id };
        const updatedProduct = await Product.findOneAndUpdate(query, { $set: req.body }, { new: true });
        res.json({ success: true, product: updatedProduct });
    } catch (error) { res.status(500).json({ error: "Failed to update" }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
        const query = isValidObjectId ? { _id: req.params.id } : { id: req.params.id };
        await Product.deleteOne(query);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Failed to delete" }); }
});

// ==========================================
// ORDER ROUTES
// ==========================================
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.json({ success: true, order: newOrder });
    } catch (error) { res.status(500).json({ error: "Failed to save order" }); }
});

app.get('/api/orders', async (req, res) => {
    try { res.json(await Order.find().sort({ date: -1 })); }
    catch (error) { res.status(500).json({ error: "Failed to fetch orders" }); }
});

app.get('/api/orders/phone/:phone', async (req, res) => {
    try { res.json(await Order.find({ phone: req.params.phone }).sort({ date: -1 })); }
    catch (error) { res.status(500).json({ error: "Failed to fetch user orders" }); }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id, { $set: { status: req.body.status } }, { new: true }
        );
        res.json({ success: true, order: updatedOrder });
    } catch (error) { res.status(500).json({ error: "Failed to update order status" }); }
});

// ==========================================
// START
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("🟢 SUCCESS: Connected to MongoDB Atlas!");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.error("🔴 CLOUD ERROR:", err));