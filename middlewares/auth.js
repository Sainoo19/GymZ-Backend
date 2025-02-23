const jwt = require('jsonwebtoken');
const RolePermission = require('../models/rolePermission');

const authenticate = (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
        console.log('No token provided'); // Thêm log để kiểm tra
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded JWT:', decoded); // Thêm log để kiểm tra payload của token JWT
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Error verifying token:', error); // Thêm log để kiểm tra lỗi
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const authorize = (requiredRoles) => {
    return (req, res, next) => {
        if (!requiredRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };