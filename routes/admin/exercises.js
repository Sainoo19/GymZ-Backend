const express = require('express');
const Exercise = require('../../models/exercises'); // Adjust the path as necessary

const router = express.Router();

// Get all exercises
router.get('/all', async (req, res) => {
    try {
        const exercises = await Exercise.find();
        res.json(exercises);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;