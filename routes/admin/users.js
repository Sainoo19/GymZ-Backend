var express = require('express');
const User = require('../../models/users');
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
var router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all users from database. */
router.get('/all', async function (req, res, next) {
  try {
      const { page = 1, limit = 3, role, status, createdAt, search } = req.query;

      const filters = {};

      if (role) {
        filters.role = new RegExp(`^${role}$`, 'i'); //Không phân biệt hoa thường
      }

      if (status) {
        filters.status = new RegExp(`^${status}$`, 'i'); //Không phân biệt hoa thường
      }

      if (createdAt) {
        filters.createdAt = { $gte: new Date(createdAt) };
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filters.$or = [
            { _id: searchRegex },    // Tìm kiếm theo ID
            { email: searchRegex },  // Tìm kiếm theo email
            { name: searchRegex }    // Tìm kiếm theo tên
        ];
      }

      const users = await User.find(filters)
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit))
          .exec();

      const count = await User.countDocuments(filters);

      res.successResponse({
          users
      }, 'Fetched all users successfully', 200, {
          totalUsers: count,
          pageSize: parseInt(limit),
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit))
      });
  } catch (err) {
      res.errorResponse('Failed to fetch users', 500, {}, { error: err.message });
  }
});


/* POST create a new user */
router.post('/create', async function (req, res, next) {
  try {
    const newUserId = await generateId('US');
    console.log(newUserId);
    const newUser = new User({
      _id: newUserId,
      ...req.body
    });
    await newUser.save();
    res.successResponse(newUser, 'User created successfully');
  } catch (err) {
    res.errorResponse('Failed to create user', 500, {}, { error: err.message });
  }
});

/* PUT update an existing user */
router.put('/update/:id', async function (req, res, next) {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedUser) {
      return res.errorResponse('User not found', 404);
    }
    res.successResponse(updatedUser, 'User updated successfully');
  } catch (err) {
    res.errorResponse('Failed to update user', 500, {}, { error: err.message });
  }
});

/* DELETE remove an existing user */
router.delete('/delete/:id', async function (req, res, next) {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.errorResponse('User not found', 404);
    }
    res.successResponse(deletedUser, 'User deleted successfully');
  } catch (err) {
    res.errorResponse('Failed to delete user', 500, {}, { error: err.message });
  }
});

/* GET user by id */
router.get('/:id', async function (req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.errorResponse('User not found', 404);
    }
    res.successResponse(user, 'Fetched user successfully');
  } catch (err) {
    res.errorResponse('Failed to fetch user', 500, {}, { error: err.message });
  }
});

/* GET all users without pagination or filters */
router.get('/all/nopagination', async function (req, res, next) {
  try {
    const users = await User.find();
    res.successResponse(users, 'Fetched all users successfully');
  } catch (err) {
    res.errorResponse('Failed to fetch users', 500, {}, { error: err.message });
  }
});

module.exports = router;