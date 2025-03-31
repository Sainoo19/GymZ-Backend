const mongoose = require('mongoose');

// filepath: C:/Users/MR. LAM/OneDrive - VLG/Desktop/GymZ/GymZBackEnd/GymZ/models/memberBill.js
const Schema = mongoose.Schema;

const memberBillSchema = new Schema({
    _id: {
        type: String,
        required: true,
    },
    memberID: {
        type: String,
        required: true,
        ref: 'Member' // Tham chiếu đến schema Member
    },
    amount: {
        type: Number,
        required: true,
        min: 0 // Số tiền phải lớn hơn hoặc bằng 0
    },
    paymentDate: {
        type: Date,
        required: false,
        default: Date.now // Ngày thanh toán mặc định là ngày hiện tại
    },
    paymentMethod: {
        type: String,
        required: false,
        enum: ['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'],
        default: 'CASH' // Phương thức thanh toán mặc định là tiền mặt
    },
    description: {
        type: String,
        required: false,
        default: null // Mô tả thêm (nếu có)
    }
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Tạo model từ schema
const MemberBill = mongoose.model('MemberBill', memberBillSchema);

module.exports = MemberBill;