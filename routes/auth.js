const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/users');
const Employee = require('../models/employees');
const generateId = require('../utils/generateId');
const customResponse = require('../utils/customResponse');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

router.post('/register/user', async (req, res) => {
    const { email, password, phone, name, address } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.errorResponse('Email already exists', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = await generateId('US');
        const newUser = new User({
            _id: newUserId,
            email,
            password: hashedPassword,
            phone,
            name,
            role: 'user',
            status: 'active',
            address
        });

        await newUser.save();
        res.successResponse({ message: 'User registered successfully' }, 'User registered successfully', 201);
    } catch (error) {
        console.error('Error registering user:', error);
        res.errorResponse('Server error', 500, { error });
    }
});

router.post('/login/user', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.errorResponse('Invalid email or password', 401);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.errorResponse('Invalid email or password', 401);
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.successResponse({ token, user }, 'User logged in successfully');
    } catch (error) {
        console.error('Error logging in user:', error);
        res.errorResponse('Server error', 500, { error });
    }
});

router.post('/login/employee', async (req, res) => {
    const { email, password } = req.body;

    try {
        const employee = await Employee.findOne({ email });
        if (!employee) {
            return res.errorResponse('Invalid email or password', 401);
        }

        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) {
            return res.errorResponse('Invalid email or password', 401);
        }

        const token = jwt.sign({ id: employee._id, role: employee.role, branch_id: employee.branch_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.successResponse({ token, employee }, 'Employee logged in successfully');
    } catch (error) {
        console.error('Error logging in employee:', error);
        res.errorResponse('Server error', 500, { error });
    }
});

module.exports = router;