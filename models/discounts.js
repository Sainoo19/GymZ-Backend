const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    code: { type: String, required: true },
    description: { type: String, required: true },
    discountPercent: { type: Number, required: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    usageLimit: { type: Number, required: true },
    status: { type: String, required: true, enum: ['active', 'inactive'] }
});

const Discount = mongoose.model('Discount', discountSchema);

module.exports = Discount;