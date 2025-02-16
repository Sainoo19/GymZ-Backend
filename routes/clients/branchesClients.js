const express = require('express');
const Branch = require('../../models/branches'); // Assuming you have a Branch model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);



router.get('/all', async function (req, res, next) {
    try {
        const { page = 1, limit = 10, search, location } = req.query;

        const filters = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Tạo biểu thức chính quy không phân biệt hoa thường
            filters.$or = [
                { _id: searchRegex }, // Tìm kiếm theo branchID
                { name: searchRegex }, // Tìm kiếm theo tên chi nhánh
                { phone: searchRegex } // Tìm kiếm theo số điện thoại
            ];
        }

        if (location) {
            const locationRegex = new RegExp(location, 'i');
            filters['address.city'] = locationRegex; // Lọc theo thành phố
        }

        const branches = await Branch.find(filters)
            .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
            .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
            .exec();

        const count = await Branch.countDocuments(filters);

        res.successResponse({
            branches
        }, 'Fetched all branches successfully', 200, {
            totalBranches: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (err) {
        res.errorResponse('Failed to fetch branches', 500, {}, { error: err.message });
    }
});
/* GET all branches from database. */
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const branches = await Branch.find();
        res.successResponse(branches, 'Fetched all branches successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch branches', 500, {}, { error: err.message });
    }
});

router.get('/all/nopagination', async function (req, res, next) {
    try {
        const branches = await Branch.find();
        res.successResponse(branches, 'Fetched all branches successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch branches', 500, {}, { error: err.message });
    }
});

/* POST create a new branch */
router.post('/create', async function (req, res, next) {
    try {
        const newBranchId = await generateId('BR');
        const newBranch = new Branch({
            _id: newBranchId,
            ...req.body
        });
        await newBranch.save();
        res.successResponse(newBranch, 'Branch created successfully');
    } catch (err) {
        res.errorResponse('Failed to create branch', 500, {}, { error: err.message });
    }
});

/* PUT update an existing branch */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedBranch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedBranch) {
            return res.errorResponse('Branch not found', 404);
        }
        res.successResponse(updatedBranch, 'Branch updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update branch', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing branch */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedBranch = await Branch.findByIdAndDelete(req.params.id);
        if (!deletedBranch) {
            return res.errorResponse('Branch not found', 404);
        }
        res.successResponse(deletedBranch, 'Branch deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete branch', 500, {}, { error: err.message });
    }
});

/* GET branch by id */
router.get('/:id', async function (req, res, next) {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) {
            return res.errorResponse('Branch not found', 404);
        }
        res.successResponse(branch, 'Fetched branch successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch branch', 500, {}, { error: err.message });
    }
});

module.exports = router;