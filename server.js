require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https');
const nodemailer = require('nodemailer'); 

const app = express();
app.use(cors()); 
app.use('/images', express.static('images'));
app.use(express.json({ limit: '10mb' })); 

const MONGO_URI = "mongodb+srv://karimlaham232_db_user:karim.1234@cluster0.rcrmtnz.mongodb.net/syriacare?retryWrites=true&w=majority";

// Configure the Nodemailer bot using your secret .env variables
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

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
    inStock: { type: Boolean, default: true }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    location: String,
    items: Array,
    total: Number,
    promoCode: String,          // 🟢 Saves the promo code (e.g., "SYRIA10")
    discountPercentage: Number, // 🟢 Saves the discount amount (e.g., 10)
    status: { type: String, default: 'Pending' }, 
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

const userSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: String,
    email: { type: String, required: true }, 
    address: String,
    password: String,
    resetOTP: String, 
    otpExpiry: Date,  
    date: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const promoSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discountPercentage: { type: Number, required: true }, 
    isActive: { type: Boolean, default: true },
    expiryDate: Date 
});
const Promo = mongoose.model('Promo', promoSchema);

// ==========================================
// API ROUTES
// ==========================================

app.get('/', (req, res) => {
    res.status(200).send('SyriaCare Express API is live! 🚀');
});

app.get('/ping', async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send('Server and Database are both awake! 🚀');
    } catch (error) { 
        res.status(500).send('Database connection error'); 
    }
});

let cachedSYPRate = 14500; 
let lastRateFetch = 0;

app.get('/api/rate', (req, res) => {
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
            const match = data.match(/for buying and ([\d,]+) SYP for selling/i);
            if (match && match[1]) {
                cachedSYPRate = parseInt(match[1].replace(/,/g, ''));
                lastRateFetch = Date.now();
            }
            res.json({ rate: cachedSYPRate, source: 'live' });
        });
    }).on('error', (err) => {
        res.json({ rate: cachedSYPRate, source: 'error-fallback' });
    });
});

// --- PRODUCT ROUTES ---
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

// --- ORDER ROUTES ---
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
            req.params.id, 
            { $set: { status: req.body.status } }, 
            { new: true }
        );
        res.json({ success: true, order: updatedOrder });
    } catch (error) { res.status(500).json({ error: "Failed to update order status" }); }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Failed to delete order" }); }
});

// --- USER ACCOUNTS ROUTES ---
app.post('/api/users/register', async (req, res) => {
    try {
        const existingPhone = await User.findOne({ phone: req.body.phone });
        if (existingPhone) return res.status(400).json({ error: "Phone number is already registered." });
        
        const existingEmail = await User.findOne({ email: req.body.email });
        if (existingEmail) return res.status(400).json({ error: "Email is already registered." });

        const newUser = new User(req.body);
        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (err) { res.status(500).json({ error: "Registration failed." }); }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.body.phone, password: req.body.password });
        if (!user) return res.status(401).json({ error: "Invalid phone number or password." });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ error: "Login failed." }); }
});

app.get('/api/users', async (req, res) => {
    try { res.json(await User.find().sort({ date: -1 }).select('-password')); } 
    catch (err) { res.status(500).json({ error: "Failed to fetch users." }); }
});

// --- FORGOT PASSWORD ROUTES ---
app.post('/api/users/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(400).json({ error: "Email not found in our system." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.resetOTP = otp;
        user.otpExpiry = Date.now() + 10 * 60 * 1000; 
        await user.save();

        const mailOptions = {
            from: `"SyriaCare Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'SyriaCare Express - Password Reset Code',
            text: `Hi ${user.name},\n\nYour password reset code is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "OTP sent to your email!" });
    } catch (err) {
        console.error("Email Error:", err);
        res.status(500).json({ error: "Failed to send email. Check server configuration." });
    }
});

app.post('/api/users/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });

        if (!user || user.resetOTP !== otp || user.otpExpiry < Date.now()) {
            return res.status(400).json({ error: "Invalid or expired OTP code." });
        }

        user.password = newPassword;
        user.resetOTP = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.json({ success: true, message: "Password reset successfully!" });
    } catch (err) { res.status(500).json({ error: "Failed to reset password." }); }
});

// --- PROMO CODE ROUTES ---

// 1. Apply Promo Code (Frontend Cart)
app.post('/api/promo/apply', async (req, res) => {
    try {
        const { code } = req.body;
        const promo = await Promo.findOne({ code: code.toUpperCase(), isActive: true });

        if (!promo) {
            return res.status(400).json({ error: "Invalid or inactive promo code." });
        }

        if (promo.expiryDate && promo.expiryDate < Date.now()) {
            return res.status(400).json({ error: "This promo code has expired." });
        }

        res.json({ success: true, discountPercentage: promo.discountPercentage, code: promo.code });
    } catch (err) {
        res.status(500).json({ error: "Failed to validate promo code." });
    }
});

// 2. Get All Promo Codes (Admin Panel)
app.get('/api/promo', async (req, res) => {
    try {
        const promos = await Promo.find().sort({ _id: -1 });
        res.json(promos);
    } catch (err) { 
        res.status(500).json({ error: "Failed to fetch promo codes." }); 
    }
});

// 3. Create Promo Code (Admin Panel)
app.post('/api/promo', async (req, res) => {
    try {
        const { code, discountPercentage } = req.body;
        const newPromo = new Promo({ 
            code: code.toUpperCase().trim(), 
            discountPercentage 
        });
        await newPromo.save();
        res.json({ success: true, promo: newPromo });
    } catch (err) { 
        res.status(400).json({ error: "Failed to create. Code might already exist." }); 
    }
});

// 4. Delete Promo Code (Admin Panel)
app.delete('/api/promo/:id', async (req, res) => {
    try {
        await Promo.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: "Failed to delete promo code." }); 
    }
});

// ==========================================
// CONNECT AND START
// ==========================================

const PORT = process.env.PORT || 8080; 

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SUCCESS: Server is listening on port ${PORT}`);
});

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, 
    family: 4
})
.then(async () => {
    console.log("🟢 SUCCESS: Connected to MongoDB Atlas!");
    
    try {
        const existing = await Promo.findOne({ code: 'SYRIA10' });
        if (!existing) {
            await new Promo({ code: 'SYRIA10', discountPercentage: 10 }).save();
            console.log("🎁 Test Promo Code SYRIA10 (10% off) created automatically!");
        }
    } catch (err) { console.error(err); }
})
.catch(err => console.error("🔴 DATABASE CONNECTION ERROR:", err.message));

process.on('SIGTERM', () => {
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});