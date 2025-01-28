const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        country: { type: String, required: true }
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;