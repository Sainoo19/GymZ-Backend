const mongoose = require('mongoose');

const logsGymSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    workout_id: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    notes: { type: String },
    status: { type: String, required: true }
});

const LogsGym = mongoose.model('LogsGym', logsGymSchema);

module.exports = LogsGym;