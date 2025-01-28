const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    product_id: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;