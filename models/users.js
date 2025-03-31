const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String },
    phone: { type: String,  default: ""  },
    name: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, required: true },
    avatar: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    address: {
        province: {type: String, require: true},
        district: {type: String, require: true},
        ward: {type: String, require: true},
        street: {type:String, require: true}
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;