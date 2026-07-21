const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const NEW_EMAIL = 'Anil@gmail.com';
const NEW_PASSWORD = 'Anil@1234';
const NEW_NAME = 'Anil';

async function updateSuperAdmin() {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_qr';
    await mongoose.connect(connStr);

    const superAdmin = await User.findOne({ role: 'SuperAdmin' });
    if (!superAdmin) {
      console.error('No Super Admin user found in database.');
      process.exit(1);
    }

    superAdmin.name = NEW_NAME;
    superAdmin.email = NEW_EMAIL;
    superAdmin.password = NEW_PASSWORD;
    superAdmin.rawPassword = NEW_PASSWORD;
    await superAdmin.save();

    console.log(`Super Admin updated: ${NEW_EMAIL}`);
    process.exit(0);
  } catch (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  }
}

updateSuperAdmin();
