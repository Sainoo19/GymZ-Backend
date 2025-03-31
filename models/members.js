const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const memberSchema = new Schema({
    _id: {
        type: String,
        required: true,
    },
    userID: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['GOLD', 'SILVER', 'PLATINUM', 'BASIC']   // Loại thành viên
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                return this.validFrom < value; // Đảm bảo validUntil lớn hơn validFrom
            },
            message: 'validUntil must be greater than validFrom'
        }
    },
    branchID: {
        type: String,
        required: true,

    },
    employeeID: {
        type: String,
        required: false,
        default: null

    }
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Tạo model từ schema
const Member = mongoose.model('Member', memberSchema);

module.exports = Member;