const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    branch_id: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    salary: {
        type: Number,
        required: true
    },
    hiredAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;