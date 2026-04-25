const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https'); // 🟢 ADDED: Required to fetch the live rate from sp-today

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.json({ limit: '10mb' })); 

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
    description: String,
    inStock: { type: Boolean, default: true } // Out of stock tracker
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

// RAILWAY HEALTHCHECK: Tells Railway the server is alive immediately
app.get('/', (req, res) => {
    res.status(200).send('SyriaCare Express API is live! 🚀');
});

// PING: Keeps the DB connection awake
app.get('/ping', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send('Server and Database are both awake! 🚀');
    } catch (error) { 
        res.status(500).send('Database connection error'); 
    }
});

// 🟢 NEW: LIVE SYRIAN POUND EXCHANGE RATE API
let cachedSYPRate = 14500; // Safe default if the website is down
let lastRateFetch = 0;

app.get('/api/rate', (req, res) => {
    // Cache the rate for 1 hour so SP-Today doesn't block your server IP
    if (Date.now() - lastRateFetch < 3600000) {
        return res.json({ rate: cachedSYPRate, source: 'cache' });
    }

    const options = {
        hostname: 'sp-today.com',
        path: '/en/currency/us-dollar',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    };

    https.get(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
            // Read the HTML text to find "for buying and 14,850 SYP for selling"
            const match = data.match(/for buying and ([\d,]+) SYP for selling/i);
            if (match && match[1]) {
                cachedSYPRate = parseInt(match[1].replace(/,/g, ''));
                lastRateFetch = Date.now();
            }
            res.json({ rate: cachedSYPRate, source: 'live' });
        });
    }).on('error', (err) => {
        // If sp-today is down, return the last known rate safely
        res.json({ rate: cachedSYPRate, source: 'error-fallback' });
    });
});

// --- PRODUCT ROUTES ---
app.get('/api/products', async (req, res) => {
    try { 
        res.json(await Product.find({})); 
    } catch (err) { 
        res.status(500).json({ message: "Error fetching products" }); 
    }
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

// --- ORDER ROUTES ---
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
        res.json(await Order.find().sort({ date: -1 })); 
    } catch (error) { 
        res.status(500).json({ error: "Failed to fetch orders" }); 
    }
});

app.get('/api/orders/phone/:phone', async (req, res) => {
    try { 
        res.json(await Order.find({ phone: req.params.phone }).sort({ date: -1 })); 
    } catch (error) { 
        res.status(500).json({ error: "Failed to fetch user orders" }); 
    }
});

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

// --- USER ACCOUNTS ROUTES ---
app.post('/api/users/register', async (req, res) => {
    try {
        const existingUser = await User.findOne({ phone: req.body.phone });
        if (existingUser) {
            return res.status(400).json({ error: "Phone number is already registered." });
        }
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (err) { 
        res.status(500).json({ error: "Registration failed." }); 
    }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.body.phone, password: req.body.password });
        if (!user) {
            return res.status(401).json({ error: "Invalid phone number or password." });
        }
        res.json({ success: true, user });
    } catch (err) { 
        res.status(500).json({ error: "Login failed." }); 
    }
});

app.get('/api/users', async (req, res) => {
    try { 
        res.json(await User.find().sort({ date: -1 }).select('-password')); 
    } catch (err) { 
        res.status(500).json({ error: "Failed to fetch users." }); 
    }
});

// ==========================================
// CONNECT AND START
// ==========================================

// 1. Define Port
const PORT = process.env.PORT || 8080; 

// 2. START LISTENING IMMEDIATELY 
// This allows the server to pass the health check before the DB connects
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SUCCESS: Server is listening on port ${PORT}`);
});

// 3. CONNECT TO DATABASE IN THE BACKGROUND
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, 
    family: 4
})
.then(() => {
    console.log("🟢 SUCCESS: Connected to MongoDB Atlas!");
})
.catch(err => {
    console.error("🔴 DATABASE CONNECTION ERROR:", err.message);
});

// 4. Graceful Shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});