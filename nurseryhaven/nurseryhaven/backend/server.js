const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://VikasR:VIKAS@cluster.kwe5ycq.mongodb.net/nursery_haven?retryWrites=true&w=majority&appName=Cluster';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  userType: { type: String, default: 'customer' },
  registeredAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: Number,
  description: { type: String, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  stock: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  careInstructions: String,
  isPopular: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: String,
  customerEmail: String,
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  subtotal: Number,
  tax: Number,
  shipping: Number,
  total: Number,
  paymentMethod: String,
  paymentStatus: { type: String, default: 'pending' },
  orderStatus: { type: String, default: 'processing' },
  deliveryDetails: {
    name: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pin: String,
    notes: String
  },
  basketReady: {
    fulfillmentType: String,
    preferredDate: String,
    preferredTime: String,
    specialInstructions: String
  },
  deliveryAddress: String,
  deliveryDate: String,
  deliveryTime: String,
  specialInstructions: String,
  orderId: String,
  transactionId: String,
  codCharge: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Consultation Schema
const consultationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Consultation = mongoose.model('Consultation', consultationSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'nursery_haven_secret_key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Product Routes
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    let query = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ message: 'Product added successfully', product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product', details: error.message });
  }
});

// Order Routes
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    // Get customer details for the order
    const customer = await User.findById(req.user.id);

    const orderData = {
      ...req.body,
      customerId: req.user.id,
      customerName: customer.name,
      customerEmail: customer.email,
      orderId: 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      transactionId: 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase()
    };

    // Check stock availability and reduce stock for each item
    for (const item of orderData.items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(400).json({ error: `Product ${item.name} not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }

      // Reduce the stock
      product.stock -= item.quantity;
      await product.save();
    }

    const order = new Order(orderData);
    await order.save();

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        orderId: order.orderId,
        transactionId: order.transactionId,
        total: order.total,
        status: order.orderStatus
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to place order', details: error.message });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    let query = {};

    if (req.user.userType !== 'admin') {
      query.customerId = req.user.id;
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

app.get('/api/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    let query = { orderId: req.params.orderId };

    if (req.user.userType !== 'admin') {
      query.customerId = req.user.id;
    }

    const order = await Order.findOne(query).populate('customerId', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});

// Consultation Routes
app.post('/api/consultations', async (req, res) => {
  try {
    const consultation = new Consultation(req.body);
    await consultation.save();
    res.status(201).json({ message: 'Consultation request submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit consultation', details: error.message });
  }
});

app.get('/api/consultations', authenticateToken, async (req, res) => {
  try {
    // Only admin can view all consultations
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const consultations = await Consultation.find().sort({ createdAt: -1 });
    res.json(consultations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch consultations', details: error.message });
  }
});

// Admin Routes
app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const totalCustomers = await User.countDocuments({ userType: 'customer' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ paymentStatus: 'completed' });
    const pendingConsultations = await Consultation.countDocuments({ status: 'pending' });

    // Calculate total revenue from completed orders
    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    const recentOrders = await Order.find()
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: {
        totalCustomers,
        totalProducts,
        totalOrders,
        completedOrders,
        totalRevenue,
        pendingConsultations
      },
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// Get all customers (admin only)
app.get('/api/admin/customers', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const customers = await User.find({ userType: 'customer' }).sort({ registeredAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
  }
});

// Get specific customer (admin only)
app.get('/api/admin/customers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const customer = await User.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer', details: error.message });
  }
});

// Delete customer (admin only)
app.delete('/api/admin/customers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer', details: error.message });
  }
});

// Get all orders (admin only)
app.get('/api/admin/orders', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, customerId } = req.query;
    let query = {};

    if (status) {
      query.orderStatus = status;
    }

    if (customerId) {
      query.customerId = customerId;
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 });

    const ordersWithCustomerInfo = orders.map(order => ({
      ...order.toObject(),
      customerName: order.customerId?.name || 'Unknown',
      customerEmail: order.customerId?.email || 'Unknown',
      orderDate: order.createdAt,
      deliveryStatus: order.orderStatus,
      paymentStatus: order.paymentStatus || 'pending',
      paymentMethod: order.paymentMethod || 'N/A',
      total: order.total || 0
    }));

    res.json(ordersWithCustomerInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

// Get specific order (admin only)
app.get('/api/admin/orders/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const order = await Order.findById(req.params.id).populate('customerId', 'name email');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderWithCustomerInfo = {
      ...order.toObject(),
      customerName: order.customerId?.name || 'Unknown',
      customerEmail: order.customerId?.email || 'Unknown',
      orderDate: order.createdAt,
      deliveryStatus: order.orderStatus,
      paymentStatus: order.paymentStatus || 'pending',
      paymentMethod: order.paymentMethod || 'N/A'
    };

    res.json(orderWithCustomerInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});

// Update order delivery status (admin only)
app.put('/api/admin/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update to next status in sequence
    const statusFlow = ['processing', 'shipped', 'delivered'];
    const currentIndex = statusFlow.indexOf(order.orderStatus);
    const nextStatus = currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : order.orderStatus;

    order.orderStatus = nextStatus;
    await order.save();

    const updatedOrder = {
      ...order.toObject(),
      deliveryStatus: nextStatus
    };

    res.json({ order: updatedOrder });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status', details: error.message });
  }
});

// Delete order (admin only)
app.delete('/api/admin/orders/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find the order first to restore stock
    const order = await Order.findById(req.params.id);
    if (order) {
      // Restore stock for each item in the order
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted successfully and stock restored' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order', details: error.message });
  }
});

// Plants/Products routes for admin
app.get('/api/plants', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plants', details: error.message });
  }
});

app.get('/api/plants/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plant', details: error.message });
  }
});

app.post('/api/plants', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ message: 'Plant added successfully', product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add plant', details: error.message });
  }
});

app.put('/api/plants/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json({ message: 'Plant updated successfully', product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plant', details: error.message });
  }
});

app.put('/api/plants/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Toggle status
    product.status = product.status === 'active' ? 'inactive' : 'active';
    await product.save();

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle plant status', details: error.message });
  }
});

app.delete('/api/plants/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plant', details: error.message });
  }
});

// Update consultation status (admin only)
app.put('/api/consultations/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const consultation = await Consultation.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );

    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }

    res.json(consultation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update consultation', details: error.message });
  }
});

// Delete consultation (admin only)
app.delete('/api/consultations/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await Consultation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Consultation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete consultation', details: error.message });
  }
});

// Analytics endpoint for charts and time-based data
app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { timeframe = 'daily', metric = 'revenue' } = req.query;

    // Calculate date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get today's revenue
    const todayRevenue = await Order.aggregate([
      { 
        $match: { 
          paymentStatus: 'completed',
          createdAt: { $gte: today }
        }
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // Get this month's revenue
    const monthRevenue = await Order.aggregate([
      { 
        $match: { 
          paymentStatus: 'completed',
          createdAt: { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // Get this year's revenue
    const yearRevenue = await Order.aggregate([
      { 
        $match: { 
          paymentStatus: 'completed',
          createdAt: { $gte: startOfYear }
        }
      },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // Generate chart data based on timeframe
    let chartData = { labels: [], values: [] };
    let startDate, dateFormat, groupBy;

    if (timeframe === 'daily') {
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Last 7 days
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      groupBy = '$dateStr';

      // Generate labels for last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        chartData.labels.push(date.toLocaleDateString());
      }
    } else if (timeframe === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1); // Last 6 months
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      groupBy = '$dateStr';

      // Generate labels for last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        chartData.labels.push(date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
      }
    } else {
      startDate = new Date(now.getFullYear() - 2, 0, 1); // Last 3 years
      dateFormat = { $dateToString: { format: '%Y', date: '$createdAt' } };
      groupBy = '$dateStr';

      // Generate labels for last 3 years
      for (let i = 2; i >= 0; i--) {
        chartData.labels.push((now.getFullYear() - i).toString());
      }
    }

    // Aggregate data based on metric and timeframe
    let matchCondition = { createdAt: { $gte: startDate } };
    if (metric === 'revenue') {
      matchCondition.paymentStatus = 'completed';
    }

    const aggregatedData = await Order.aggregate([
      { $match: matchCondition },
      {
        $addFields: {
          dateStr: dateFormat
        }
      },
      {
        $group: {
          _id: groupBy,
          value: metric === 'revenue' ? { $sum: '$total' } : 
                 metric === 'orders' ? { $sum: 1 } : 
                 { $addToSet: '$customerId' }
        }
      },
      {
        $addFields: {
          finalValue: metric === 'customers' ? { $size: '$value' } : '$value'
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing data points with zeros
    const dataMap = {};
    aggregatedData.forEach(item => {
      dataMap[item._id] = item.finalValue;
    });

    chartData.values = chartData.labels.map((label, index) => {
      let key;
      if (timeframe === 'daily') {
        const date = new Date(now.getTime() - ((6 - index) * 24 * 60 * 60 * 1000));
        key = date.toISOString().split('T')[0];
      } else if (timeframe === 'monthly') {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = (now.getFullYear() - (2 - index)).toString();
      }
      return dataMap[key] || 0;
    });

    // Revenue distribution for pie chart
    const distributionData = {
      labels: ['Today', 'This Month', 'This Year'],
      values: [
        todayRevenue[0]?.total || 0,
        monthRevenue[0]?.total || 0,
        yearRevenue[0]?.total || 0
      ]
    };

    // Category performance data
    const categoryRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          orders: { $sum: 1 }
        }
      }
    ]);

    const categoryData = {
      labels: categoryRevenue.map(cat => cat._id),
      revenues: categoryRevenue.map(cat => cat.revenue),
      orders: categoryRevenue.map(cat => cat.orders)
    };

    // Revenue breakdown for table
    const revenueBreakdown = [
      {
        period: 'Today',
        revenue: todayRevenue[0]?.total || 0,
        orders: await Order.countDocuments({ 
          paymentStatus: 'completed',
          createdAt: { $gte: today }
        })
      },
      {
        period: 'This Month',
        revenue: monthRevenue[0]?.total || 0,
        orders: await Order.countDocuments({ 
          paymentStatus: 'completed',
          createdAt: { $gte: startOfMonth }
        })
      },
      {
        period: 'This Year',
        revenue: yearRevenue[0]?.total || 0,
        orders: await Order.countDocuments({ 
          paymentStatus: 'completed',
          createdAt: { $gte: startOfYear }
        })
      }
    ];

    res.json({
      todayRevenue: todayRevenue[0]?.total || 0,
      monthRevenue: monthRevenue[0]?.total || 0,
      yearRevenue: yearRevenue[0]?.total || 0,
      chartData,
      distributionData,
      categoryData,
      revenueBreakdown
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data', details: error.message });
  }
});



// Initialize app with admin user only
async function initializeApp() {
  try {
    // Create admin user only if it doesn't exist
    const adminExists = await User.findOne({ email: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      const adminUser = new User({
        name: 'Admin',
        email: 'admin',
        password: hashedPassword,
        userType: 'admin'
      });
      await adminUser.save();
      console.log('✅ Admin user created');
    }
  } catch (error) {
    console.error('❌ Error initializing app:', error);
  }
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Access your app at: http://0.0.0.0:${PORT}`);
  await initializeApp();
});

module.exports = app;