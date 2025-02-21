const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true }
});

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;