const express = require("express");
const ProductCategory = require("../../models/productCategory"); // Import model
const customResponse = require("../../utils/customResponse");
const generateId = require("../../utils/generateId");

const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all product categories */
router.get("/all", async (req, res) => {
    try {
        const categories = await ProductCategory.find();
        res.successResponse(categories, "Fetched all categories successfully");
    } catch (err) {
        res.errorResponse("Failed to fetch categories", 500, {}, { error: err.message });
    }
});

/* POST create a new category */
router.post("/create", async (req, res) => {
    try {
        const newCategoryId = await generateId("PC"); // Tạo ID mới với tiền tố "PC"
        const { name, description } = req.body;

        const newCategory = new ProductCategory({
            _id: newCategoryId,
            name,
            description,
        });

        await newCategory.save();
        res.successResponse(newCategory, "Category created successfully");
    } catch (err) {
        res.errorResponse("Failed to create category", 500, {}, { error: err.message });
    }
});

/* PUT update an existing category */
router.put("/update/:id", async (req, res) => {
    try {
        const updatedCategory = await ProductCategory.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedCategory) {
            return res.errorResponse("Category not found", 404);
        }
        res.successResponse(updatedCategory, "Category updated successfully");
    } catch (err) {
        res.errorResponse("Failed to update category", 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing category */
router.delete("/delete/:id", async (req, res) => {
    try {
        const deletedCategory = await ProductCategory.findByIdAndDelete(req.params.id);
        if (!deletedCategory) {
            return res.errorResponse("Category not found", 404);
        }
        res.successResponse(deletedCategory, "Category deleted successfully");
    } catch (err) {
        res.errorResponse("Failed to delete category", 500, {}, { error: err.message });
    }
});

/* GET category by id */
router.get("/:id", async (req, res) => {
    try {
        const category = await ProductCategory.findById(req.params.id);
        if (!category) {
            return res.errorResponse("Category not found", 404);
        }
        res.successResponse(category, "Fetched category successfully");
    } catch (err) {
        res.errorResponse("Failed to fetch category", 500, {}, { error: err.message });
    }
});

module.exports = router;
