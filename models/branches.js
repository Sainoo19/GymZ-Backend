const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true }
});

const branchSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    manager_id: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    address: { type: addressSchema, required: true }
});

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;
