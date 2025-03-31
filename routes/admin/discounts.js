const express = require('express');
const Discount = require('../../models/discounts'); // Assuming you have a Discount model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();
const { authenticate, authorize } = require('../../middlewares/auth');

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all discounts with pagination and filtering */
router.get('/all', async function (req, res, next) {
    try {
        const { page = 1, limit = 10, status, validFrom, validUntil, search } = req.query;

        const filters = {};

        if (status) {
            filters.status = status;
        }

        if (validFrom && validUntil) {
            filters.validFrom = { $gte: new Date(validFrom) };
            filters.validUntil = { $lte: new Date(validUntil) };
        }

        if (search) {
            filters.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        const discounts = await Discount.find(filters)
            .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
            .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
            .exec();

        const count = await Discount.countDocuments(filters);

        res.successResponse({
            discounts
        }, 'Fetched all discounts successfully', 200, {
            totalDiscounts: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (err) {
        res.errorResponse('Failed to fetch discounts', 500, {}, { error: err.message });
    }
});

/* GET all discounts without pagination */
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const discounts = await Discount.find();
        res.successResponse(discounts, 'Fetched all discounts successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch discounts', 500, {}, { error: err.message });
    }
});

/* POST create a new discount */
router.post('/create', async function (req, res, next) {
    try {
        const newDiscountId = await generateId('DIS');
        const newDiscount = new Discount({
            _id: newDiscountId,
            ...req.body
        });
        await newDiscount.save();
        res.successResponse(newDiscount, 'Discount created successfully');
    } catch (err) {
        res.errorResponse('Failed to create discount', 500, {}, { error: err.message });
    }
});

router.post("/create-discount-combo", authenticate, authorize(["admin", "manager"]), async (req, res) => {
    try {
        const { selectedCombos, discountPercent, validFrom, validUntil,description, usageLimit, code } = req.body;

        // Kiểm tra dữ liệu đầu vào
        if (!selectedCombos || selectedCombos.length === 0) {
            return res.status(400).json({ error: "Chưa chọn sản phẩm nào để tạo khuyến mãi" });
        }
        if (!discountPercent || discountPercent <= 0) {
            return res.status(400).json({ error: "Mức giảm giá không hợp lệ" });
        }
        if (!validFrom || !validUntil) {
            return res.status(400).json({ error: "Ngày áp dụng không hợp lệ" });
        }
        if (!usageLimit || usageLimit <= 0) {
            return res.status(400).json({ error: "Giới hạn sử dụng không hợp lệ" });
        }

        // Chuyển danh sách combo thành danh sách sản phẩm áp dụng
        const applicableProducts = selectedCombos.flatMap(combo => combo.split("-"));
        
        // Tạo ID mới cho khuyến mãi
        const newDiscountId = await generateId('DIS');

        // Tạo mã giảm giá mới
        const newDiscount = new Discount({
            _id: newDiscountId,
            code, // Tạo mã giảm giá duy nhất
            description,
            discountPercent,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            usageLimit,
            applicableProducts,
            status: "active",
        });

        // Lưu vào database
        await newDiscount.save();

        res.status(201).json({ message: "Khuyến mãi đã được tạo thành công!", discount: newDiscount });

    } catch (error) {
        console.error("Lỗi khi tạo khuyến mãi:", error);
        res.status(500).json({ error: "Lỗi server, không thể tạo khuyến mãi" });
    }
});


/* PUT update an existing discount */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedDiscount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedDiscount) {
            return res.errorResponse('Discount not found', 404);
        }
        res.successResponse(updatedDiscount, 'Discount updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update discount', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing discount */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedDiscount = await Discount.findByIdAndDelete(req.params.id);
        if (!deletedDiscount) {
            return res.errorResponse('Discount not found', 404);
        }
        res.successResponse(deletedDiscount, 'Discount deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete discount', 500, {}, { error: err.message });
    }
});

/* GET discount by id */
// router.get('/:id', async function (req, res, next) {
//     try {
//         const discount = await Discount.findById(req.params.id);
//         if (!discount) {
//             return res.errorResponse('Discount not found', 404);
//         }
//         res.successResponse(discount, 'Fetched discount successfully');
//     } catch (err) {
//         res.errorResponse('Failed to fetch discount', 500, {}, { error: err.message });
//     }
// });

router.get('/getVoucher', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({
                status: "error",
                code: 400,
                message: "Code is required"
            });
        }

        // Lấy ngày hiện tại
        const today = new Date();

        // Tìm voucher hợp lệ
        const discount = await Discount.findOne({
            code,
            status: 'active',
            validFrom: { $lte: today },  // Ngày bắt đầu <= hôm nay
            validUntil: { $gte: today }, // Ngày hết hạn >= hôm nay
            usageLimit: { $gt: 0 }       // Số lần sử dụng còn > 0
        }).select('-__v'); // Loại bỏ trường __v để gọn response

        if (!discount) {
            return res.status(404).json({
                status: "error",
                code: 404,
                message: "Discount not found, expired, or usage limit reached"
            });
        }

        res.status(200).json({
            status: "success",
            code: 200,
            message: "Discount retrieved successfully",
            data: discount
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            code: 500,
            message: "Internal Server Error",
            error: err.message
        });
    }
});

module.exports = router;