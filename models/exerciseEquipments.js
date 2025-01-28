const mongoose = require('mongoose');

const exerciseEquipmentSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    }
});

const ExerciseEquipment = mongoose.model('ExerciseEquipment', exerciseEquipmentSchema);

module.exports = ExerciseEquipment;