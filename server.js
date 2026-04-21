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
// SCRAPE ENDPOINT
// ==========================================
app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const isWatsons = url.includes('watsons.com.tr');
    const isGratis  = url.includes('gratis.com');

    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    ];
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Referer': isWatsons ? 'https://www.watsons.com.tr/' : 'https://www.gratis.com/',
                'DNT': '1',
            },
            maxRedirects: 5,
        });

        const html = response.data;
        const $ = cheerio.load(html);

        let name = '', image = '', priceTRY = 0, description = '';

        // WATSONS selectors
        if (isWatsons) {
            name = $('h1.product-name').first().text().trim()
                || $('[class*="product-title"]').first().text().trim()
                || $('[class*="ProductName"]').first().text().trim()
                || $('h1').first().text().trim();

            image = $('img.product-image').attr('src')
                || $('[class*="product-image"] img').first().attr('src')
                || $('[class*="ProductImage"] img').first().attr('src')
                || $('meta[property="og:image"]').attr('content') || '';

            const priceText = $('[class*="price"]').first().text().replace(/[^0-9,\.]/g, '').replace(',', '.');
            priceTRY = parseFloat(priceText) || 0;
            description = $('[class*="description"]').first().text().trim().substring(0, 200) || '';
        }

        // GRATIS selectors
        if (isGratis) {
            name = $('h1.product-detail__name').first().text().trim()
                || $('[class*="product-name"]').first().text().trim()
                || $('h1').first().text().trim();

            image = $('[class*="product-detail"] img').first().attr('src')
                || $('img[class*="product"]').first().attr('src')
                || $('meta[property="og:image"]').attr('content') || '';

            const priceText = $('[class*="price"]').first().text().replace(/[^0-9,\.]/g, '').replace(',', '.');
            priceTRY = parseFloat(priceText) || 0;
            description = $('[class*="description"]').first().text().trim().substring(0, 200) || '';
        }

        // UNIVERSAL fallback — og meta tags work on almost every site
        if (!name)  name  = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || '';
        if (!image) image = $('meta[property="og:image"]').attr('content') || '';
        if (!description) description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

        // Fix relative image URLs
        if (image && image.startsWith('/')) {
            const base = new URL(url);
            image = `${base.protocol}//${base.host}${image}`;
        }

        const store = isWatsons ? 'Watsons' : isGratis ? 'Gratis' : 'Watsons';

        // Auto-detect category
        const text = (name + ' ' + description).toLowerCase();
        let category = 'Personal Care';
        if (/mascara|ruj|fondöten|eyeliner|göz kalemi|lipstick|foundation|blush|bronzer|makyaj|makeup/.test(text)) category = 'Makeup';
        else if (/serum|krem|moisturizer|cleanser|toner|yüz|cilt|skin|cream|nemlendirici|temizleyici/.test(text)) category = 'Skin Care';
        else if (/şampuan|saç|shampoo|conditioner|hair|saç kremi/.test(text)) category = 'Hair Care';
        else if (/parfüm|deodorant|perfume|body spray|koku/.test(text)) category = 'Perfume & Deodorant';
        else if (/bebek|baby|anne|çocuk|mother/.test(text)) category = 'Mother & Baby';
        else if (/güneş|spf|solar|sun/.test(text)) category = 'Solar Products';
        else if (/elektrik|epilator|saç kurutma|hair dryer/.test(text)) category = 'Electrical Products';

        if (!name) {
            return res.status(422).json({ error: 'Could not extract product — page may require JavaScript. Try a different product URL.' });
        }

        res.json({ name, image, priceTRY, description: description.substring(0, 300), store, category, success: true });

    } catch (err) {
        console.error('Scrape error:', err.message);
        if (err.response?.status === 403 || err.response?.status === 429) {
            return res.status(403).json({ error: 'Website blocked the request. Wait a few seconds and try again.' });
        }
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            return res.status(408).json({ error: 'Request timed out. Check your internet connection on the server.' });
        }
        res.status(500).json({ error: `Could not fetch page: ${err.message}` });
    }
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