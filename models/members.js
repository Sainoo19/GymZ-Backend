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
        enum: ['BASIC' ,'GOLD', 'SILVER', 'PLATINUM']   // Loại thành viên
    },
    validFrom: {
        type: Date,
        required: false,
        default: null
    },
    validUntil: {
        type: Date,
        required: false,
        validate: {
            validator: function (value) {
                // Chỉ kiểm tra nếu cả hai giá trị không phải null
                if (value && this.validFrom) {
                    return this.validFrom < value;
                }
                // Nếu một hoặc cả hai là null, bỏ qua kiểm tra
                return true;
            },
            message: 'validUntil must be greater than validFrom'
        },
        default: null
    },
    branchID: {
        type: String,
        required: true,
    },
    employeeID: {
        type: String,
        required: false,
        default: null
    },
    registerDate: {
        type: Date,
        required: true,
        default: Date.now // Ngày đăng ký mặc định là ngày hiện tại
    },
    status: {
        type: String,
        required: true,
        enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], // Trạng thái thành viên
        default: 'ACTIVE'
    }
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Tạo model từ schema
const Member = mongoose.model('Member', memberSchema);

module.exports = Member;