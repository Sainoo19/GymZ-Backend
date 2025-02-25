const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
    role: { type: String, required: true },
    permissions: [{ type: String, ref: 'Permission' }]
});

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

module.exports = RolePermission;