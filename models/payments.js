const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    orderId: { type: String, required: true },
    user_id: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;