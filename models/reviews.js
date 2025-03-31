const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    product_id: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    status: {type: String, default: 'active'},
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    replies: [
        {
            user_id: { type: String, required: true }, // Người trả lời
            comment: { type: String, required: true }, // Bình luận trả lời
            createdAt: { type: Date, default: Date.now } // Thời gian trả lời
        }
    ]
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
//check