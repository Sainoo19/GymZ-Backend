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

// Hàm tạo access token cho User
const generateUserAccessToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Hàm tạo refresh token cho User
const generateUserRefreshToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// Hàm tạo access token cho Employee
const generateEmployeeAccessToken = (employee) => {
    return jwt.sign({ id: employee._id, role: employee.role, branch_id: employee.branch_id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Hàm tạo refresh token cho Employee
const generateEmployeeRefreshToken = (employee) => {
    return jwt.sign({ id: employee._id, role: employee.role, branch_id: employee.branch_id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

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

        const accessToken = generateUserAccessToken(user);
        const refreshToken = generateUserRefreshToken(user);

        // Set refresh token as a cookie
        res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        res.successResponse({ accessToken, user }, 'User logged in successfully');
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

        const accessToken = generateEmployeeAccessToken(employee);
        const refreshToken = generateEmployeeRefreshToken(employee);

        // Set refresh token as a cookie
        res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        res.successResponse({ accessToken, employee }, 'Employee logged in successfully');
    } catch (error) {
        console.error('Error logging in employee:', error);
        res.errorResponse('Server error', 500, { error });
    }
});

router.post('/refresh-token', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = { id: decoded.id, role: decoded.role, branch_id: decoded.branch_id };
        const accessToken = user.branch_id ? generateEmployeeAccessToken(user) : generateUserAccessToken(user);
        res.json({ accessToken });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
});
module.exports = router;