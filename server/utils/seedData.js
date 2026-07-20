const mongoose = require('mongoose');
const dotenv = require('dotenv');
const QRCode = require('qrcode');
const User = require('../models/User');
const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Setting = require('../models/Setting');
const MembershipPlan = require('../models/MembershipPlan');

dotenv.config();

const clientUrl = process.env.CLIENT_URL || 'http://172.24.134.17:5173';

const { buildMenuQrUrl } = require('../utils/tenantUtils');

const seedData = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_qr';
    console.log('Connecting to database for seeding:', connStr);
    await mongoose.connect(connStr);

    console.log('Clearing existing data...');
    await User.deleteMany();
    await Table.deleteMany();
    await Category.deleteMany();
    await MenuItem.deleteMany();
    await Setting.deleteMany();
    await MembershipPlan.deleteMany();

    console.log('Seeding Default Membership Plans...');
    const defaultPlans = [
      {
        name: '5-Day Free Trial',
        price: 0,
        durationDays: 5,
        description: 'Complete trial pack to test all features with zero risk',
        features: ['Unlimited Table QR Scans', 'Real-Time Kitchen KDS', 'Dynamic UPI QR Payment', 'WhatsApp Tax Receipt'],
        status: 'Active'
      },
      {
        name: 'Monthly Plan',
        price: 999,
        durationDays: 30,
        description: 'Standard monthly subscription for small & medium restaurants',
        features: ['Unlimited Orders & Items', 'Datatables & Live Search', 'Date Range Sales Reports', 'WhatsApp Receipt & Audio Chimes'],
        status: 'Active'
      },
      {
        name: 'Quarterly Plan',
        price: 2499,
        durationDays: 90,
        description: 'Popular 3-month savings plan for busy food outlets',
        features: ['All Monthly Features', 'Priority Support', 'Custom Tax & Currency Setup', 'Multi-Session Table Totals'],
        status: 'Active'
      },
      {
        name: 'Annual Plan',
        price: 7999,
        durationDays: 365,
        description: 'VIP annual membership with maximum savings & 24/7 dedicated support',
        features: ['All Premium Features Unlocked', 'VIP Dedicated Support', 'Unlimited Staff & Tables', 'Free System Upgrades'],
        status: 'Active'
      }
    ];

    await MembershipPlan.insertMany(defaultPlans);
    console.log('Seeded Default Membership Plans successfully!');

    console.log('Seeding Users...');
    
    // 1. SUPER ADMIN ACCOUNT
    const superAdmin = await User.create({
      name: 'Super System Admin',
      restaurantName: 'SaaS Platform Admin',
      email: 'superadmin@restaurant.com',
      password: 'superadmin123',
      rawPassword: 'superadmin123',
      role: 'SuperAdmin',
      isActive: true,
      planName: 'Annual Plan',
      planStatus: 'Active'
    });
    console.log('Created Super Admin user: superadmin@restaurant.com / superadmin123');

    // 2. RESTAURANT ADMIN ACCOUNT (5-Day Free Trial)
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const admin = await User.create({
      name: 'Rajesh Kumar',
      restaurantName: 'Royal Spice Restaurant',
      email: 'admin@restaurant.com',
      password: 'admin123',
      rawPassword: 'admin123',
      role: 'Admin',
      isActive: true,
      planName: '5-Day Free Trial',
      planStatus: 'Trialing',
      trialEndsAt,
      subscriptionEndsAt: trialEndsAt
    });
    console.log(`Created Admin user: admin@restaurant.com / admin123 (5-Day Trial Ends: ${trialEndsAt.toLocaleDateString()})`);

    // 3. KITCHEN STAFF ACCOUNT
    const kitchen = await User.create({
      name: 'Chef Ramesh',
      restaurantName: 'Royal Spice Restaurant',
      email: 'kitchen@restaurant.com',
      password: 'kitchen123',
      rawPassword: 'kitchen123',
      role: 'Kitchen',
      restaurantAdminId: admin._id,
      isActive: true
    });
    console.log('Created Kitchen user: kitchen@restaurant.com / kitchen123');

    console.log('Seeding Settings...');
    await Setting.create({
      adminId: admin._id,
      restaurantName: 'Royal Spice Restaurant',
      upiId: 'royalspice@upi',
      address: '123 Fine Dining Street, Food Court, City Center',
      phone: '+91 98765 43210',
      currency: '₹',
      taxPercentage: 5
    });

    console.log('Seeding Tables...');
    const tablesData = [
      { tableName: 'T-01', tableNumber: '1', capacity: 4, section: 'Main Hall' },
      { tableName: 'T-02', tableNumber: '2', capacity: 2, section: 'Main Hall' },
      { tableName: 'T-03', tableNumber: '3', capacity: 6, section: 'Family Corner' },
      { tableName: 'T-04', tableNumber: '4', capacity: 4, section: 'Outdoor Terrace' },
      { tableName: 'T-05', tableNumber: '5', capacity: 8, section: 'VIP Lounge' }
    ];

    for (const t of tablesData) {
      const qrDataUrl = buildMenuQrUrl(clientUrl, admin._id, t.tableNumber);
      const qrCodeImage = await QRCode.toDataURL(qrDataUrl, { errorCorrectionLevel: 'H', margin: 2, width: 300 });

      await Table.create({
        ...t,
        adminId: admin._id,
        qrCodeImage,
        qrUrl: qrDataUrl,
        status: 'Active'
      });
    }

    console.log('Seeding Categories...');
    const categoriesData = [
      { name: 'Starters & Snacks', description: 'Crispy and savory appetizers', displayOrder: 1, status: 'Active' },
      { name: 'Main Course', description: 'Delicious curries, dal, and gravies', displayOrder: 2, status: 'Active' },
      { name: 'Breads & Rice', description: 'Indian tandoori breads, biryani, and rice', displayOrder: 3, status: 'Active' },
      { name: 'Beverages & Desserts', description: 'Refreshing drinks and sweet treats', displayOrder: 4, status: 'Active' }
    ];

    const seededCategories = await Category.insertMany(categoriesData.map(c => ({ ...c, adminId: admin._id })));
    const catMap = {};
    seededCategories.forEach(c => { catMap[c.name] = c._id; });

    console.log('Seeding Menu Items...');
    const menuItemsData = [
      {
        name: 'Paneer Butter Masala',
        category: catMap['Main Course'],
        description: 'Rich cottage cheese in creamy tomato gravy with butter',
        foodType: 'Veg',
        priceType: 'Full and Half',
        halfPrice: 140,
        fullPrice: 240,
        preparationTime: 15,
        isAvailable: true,
        isFeatured: true,
        status: 'Active'
      },
      {
        name: 'Chicken Tikka Masala',
        category: catMap['Main Course'],
        description: 'Smoky grilled chicken chunks in spiced onion gravy',
        foodType: 'Non-Veg',
        priceType: 'Full and Half',
        halfPrice: 180,
        fullPrice: 320,
        preparationTime: 20,
        isAvailable: true,
        isFeatured: true,
        status: 'Active'
      },
      {
        name: 'Crispy Veg Spring Rolls',
        category: catMap['Starters & Snacks'],
        description: 'Golden fried rolls stuffed with crunchy vegetables',
        foodType: 'Veg',
        priceType: 'Single Fixed Price',
        fixedPrice: 160,
        preparationTime: 10,
        isAvailable: true,
        status: 'Active'
      },
      {
        name: 'Butter Naan',
        category: catMap['Breads & Rice'],
        description: 'Soft tandoori flatbread brushed with fresh butter',
        foodType: 'Veg',
        priceType: 'Single Fixed Price',
        fixedPrice: 45,
        preparationTime: 5,
        isAvailable: true,
        status: 'Active'
      },
      {
        name: 'Hyderabadi Chicken Biryani',
        category: catMap['Breads & Rice'],
        description: 'Aromatic basmati rice cooked with marinated chicken & spices',
        foodType: 'Non-Veg',
        priceType: 'Full and Half',
        halfPrice: 190,
        fullPrice: 310,
        preparationTime: 25,
        isAvailable: true,
        isFeatured: true,
        status: 'Active'
      },
      {
        name: 'Cold Coffee with Ice Cream',
        category: catMap['Beverages & Desserts'],
        description: 'Creamy chilled coffee topped with vanilla scoop',
        foodType: 'Veg',
        priceType: 'Single Fixed Price',
        fixedPrice: 120,
        preparationTime: 5,
        isAvailable: true,
        status: 'Active'
      }
    ];

    await MenuItem.insertMany(menuItemsData.map(m => ({ ...m, adminId: admin._id })));

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();
