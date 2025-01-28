const express = require('express');
const Food = require('../../models/food'); // Assuming you have a Food model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all food items from database. */
router.get('/all', async function (req, res, next) {
    try {
        const foods = await Food.find();
        res.successResponse(foods, 'Fetched all food items successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch food items', 500, {}, { error: err.message });
    }
});

/* POST create a new food item */
router.post('/create', async function (req, res, next) {
    try {
        const newFoodId = await generateId('FD');
        const newFood = new Food({
            _id: newFoodId,
            ...req.body
        });
        await newFood.save();
        res.successResponse(newFood, 'Food item created successfully');
    } catch (err) {
        res.errorResponse('Failed to create food item', 500, {}, { error: err.message });
    }
});

/* PUT update an existing food item */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedFood = await Food.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedFood) {
            return res.errorResponse('Food item not found', 404);
        }
        res.successResponse(updatedFood, 'Food item updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update food item', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing food item */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedFood = await Food.findByIdAndDelete(req.params.id);
        if (!deletedFood) {
            return res.errorResponse('Food item not found', 404);
        }
        res.successResponse(deletedFood, 'Food item deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete food item', 500, {}, { error: err.message });
    }
});

/* GET food item by id */
router.get('/:id', async function (req, res, next) {
    try {
        const food = await Food.findById(req.params.id);
        if (!food) {
            return res.errorResponse('Food item not found', 404);
        }
        res.successResponse(food, 'Fetched food item successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch food item', 500, {}, { error: err.message });
    }
});

module.exports = router;