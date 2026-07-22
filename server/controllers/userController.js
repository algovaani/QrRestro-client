const User = require('../models/User');
const { getTenantAdminId } = require('../middleware/tenantMiddleware');

const buildStaffQuery = (adminId, extra = {}) => ({
  ...extra,
  $or: [
    { _id: adminId },
    { restaurantAdminId: adminId, role: 'Kitchen' }
  ]
});

exports.getUsers = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }

    const { search, role, status } = req.query;
    let query = buildStaffQuery(adminId);

    if (search) {
      query = buildStaffQuery(adminId, {
        $and: [
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { mobile: { $regex: search, $options: 'i' } }
            ]
          }
        ]
      });
    }
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }

    const { name, email, mobile, password, role, status } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      mobile,
      password,
      role: role === 'Kitchen' ? 'Kitchen' : 'Kitchen',
      restaurantAdminId: adminId,
      status: status || 'Active'
    });

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        restaurantAdminId: user.restaurantAdminId
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const belongs =
      user._id.toString() === adminId.toString() ||
      (user.restaurantAdminId && user.restaurantAdminId.toString() === adminId.toString());

    if (!belongs) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this user' });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }

    const { name, email, mobile, role, status, password } = req.body;
    let user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const belongs =
      user._id.toString() === adminId.toString() ||
      (user.restaurantAdminId && user.restaurantAdminId.toString() === adminId.toString());

    if (!belongs) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this user' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (mobile !== undefined) user.mobile = mobile;
    if (role === 'Kitchen') user.role = 'Kitchen';
    if (status) user.status = status;
    if (password) user.password = password;

    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const adminId = getTenantAdminId(req.user);
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Restaurant tenant access required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user._id.toString() === adminId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    if (!user.restaurantAdminId || user.restaurantAdminId.toString() !== adminId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this user' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
