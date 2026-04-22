const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.json({ limit: '10mb' })); 

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

// Health Check for Railway
app.get('/', (req, res) => {
    res.status(200).send('SyriaCare Express API is live! 🚀');
});

app.get('/api/products', async (req, res) => {
    try { 
        // We added .limit(5) right after find({})
        res.json(await Product.find({})); 
    }
    catch (err) { res.status(500).json({ message: "Error fetching products" }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ message: "Product saved!", product: newProduct });
    } catch (err) {
        res.status(500).json({ message: "Error saving product" });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
        const query = isValidObjectId ? { _id: req.params.id } : { id: req.params.id };
        const updatedProduct = await Product.findOneAndUpdate(query, { $set: req.body }, { new: true });
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: "Failed to update" });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
        const query = isValidObjectId ? { _id: req.params.id } : { id: req.params.id };
        await Product.deleteOne(query);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.json({ success: true, order: newOrder });
    } catch (error) {
        res.status(500).json({ error: "Failed to save order" });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// RESTORED: Get orders by phone
app.get('/api/orders/phone/:phone', async (req, res) => {
    try { 
        res.json(await Order.find({ phone: req.params.phone }).sort({ date: -1 })); 
    }
    catch (error) { 
        res.status(500).json({ error: "Failed to fetch user orders" }); 
    }
});
// TEMPORARY: Nuke all Base64 images
app.get('/api/nuke-images', async (req, res) => {
    try {
        // This finds EVERY product and sets the image field to an empty string
        const result = await Product.updateMany({}, { $set: { image: "" } });
        res.json({ 
            message: "All images wiped successfully! 💣", 
            productsFixed: result.modifiedCount 
        });
    }
    catch (err) { res.status(500).json({ error: "Failed to wipe images" }); }
});

// 2. Define Port
const PORT = process.env.PORT || 8080; 

// 3. START LISTENING IMMEDIATELY 
// We do NOT put mongoose.connect inside a .then() or before this.
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SUCCESS: Server is listening on port ${PORT}`);
});

// 4. CONNECT TO DATABASE IN THE BACKGROUND
// This allows the server to pass the health check while the DB connects
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Tell it to stop trying after 5 seconds
    family: 4
})
.then(() => {
    console.log("🟢 SUCCESS: Connected to MongoDB Atlas!");
})
.catch(err => {
    console.error("🔴 DATABASE CONNECTION ERROR:", err.message);
});

// 5. Graceful Shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});