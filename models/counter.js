const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: {
        type: String, // Ví dụ: "US", "PR", "OR" - loại ID
        required: true
    },
    seq: {
        type: Number, // Giá trị sequence hiện tại
        required: true,
        default: 0
    }
});

// Tạo model Counter
const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
