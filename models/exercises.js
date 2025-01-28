const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    exercise_types_id: { type: String, required: true },
    exercise_equipments_id: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    privacy: { type: String, enum: ['public', 'private'], default: 'public' }
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

module.exports = Exercise;