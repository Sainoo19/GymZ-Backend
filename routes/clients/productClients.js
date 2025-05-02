const express = require('express');
const Product = require('../../models/products');
const ProductCategory = require('../../models/productCategories');
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const mongoose = require('mongoose'); // Thêm import mongoose
const router = express.Router();
const Order = require("../../models/orders");

// Sử dụng middleware customResponse
router.use(customResponse);

/**
 * Hàm helper để định dạng sản phẩm trả về client
 * Định nghĩa ở đầu để có thể sử dụng trong nhiều route
 */
function formatProductsResponse(products) {
    return products.map(product => {
        // Tính giá thấp nhất và cao nhất từ variations
        let minPrice = Infinity;
        let maxPrice = 0;

        if (product.variations && product.variations.length > 0) {
            product.variations.forEach(variation => {
                const salePrice = variation.salePrice;
                minPrice = Math.min(minPrice, salePrice);
                maxPrice = Math.max(maxPrice, salePrice);
            });
        }

        // Format lại sản phẩm để trả về client
        return {
            _id: product._id,
            name: product.name,
            avatar: product.avatar,
            minPrice: minPrice === Infinity ? null : minPrice,
            maxPrice: maxPrice === 0 ? null : maxPrice,
            priceRange: minPrice === maxPrice
                ? `${minPrice}`
                : `${minPrice} - ${maxPrice}`
        };
    });
}

/**
 * ROUTE SPECIFIC trước route GENERIC
 * Tất cả các route cụ thể như /all, /related phải đặt TRƯỚC route /:id
 */

// GET sản phẩm active với lọc và phân trang
router.get('/all/active', async function (req, res, next) {
    try {
        const { categories, brands, priceMin, priceMax, search, sortBy, page = 1, limit = 8 } = req.query;

        const filters = { status: "active" };

        // ✅ Chuẩn hóa category
        if (categories) {
            const categoryNames = categories.split(",");
            const matchedCategories = await ProductCategory.find({ name: { $in: categoryNames } }, { _id: 1 });
            const categoryIds = matchedCategories.map(cat => cat._id);

            if (categoryIds.length > 0) {
                filters.category = { $in: categoryIds };
            }
        }

        // ✅ Lọc theo brands
        if (brands) {
            filters.brand = { $in: brands.split(",").map(brand => brand.trim()) };
        }

        // ✅ Lọc sản phẩm theo khoảng giá
        if (priceMin || priceMax) {
            filters['variations.salePrice'] = {};

            if (priceMin) {
                filters['variations.salePrice'] = { ...filters['variations.salePrice'], $gte: parseInt(priceMin) };
            }
            if (priceMax) {
                filters['variations.salePrice'] = { ...filters['variations.salePrice'], $lte: parseInt(priceMax) };
            }
        }

        // ✅ Tìm kiếm theo tên sản phẩm
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filters.name = searchRegex;
        }

        // ✅ Sắp xếp theo giá
        let sortOption = {};
        if (sortBy === 'priceAsc') {
            sortOption = { 'variations.salePrice': 1 };
        } else if (sortBy === 'priceDesc') {
            sortOption = { 'variations.salePrice': -1 };
        }

        // Tối ưu: dùng countDocuments thay vì lấy tất cả rồi đếm
        const totalProducts = await Product.countDocuments(filters);
        const totalPages = Math.ceil(totalProducts / parseInt(limit));

        // Chỉ lấy sản phẩm cho trang hiện tại
        const products = await Product.find(filters)
            .sort(sortOption)
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        res.successResponse(
            { products },
            'Fetched filtered active products successfully',
            200,
            {
                totalProducts,
                pageSize: parseInt(limit),
                currentPage: parseInt(page),
                totalPages
            }
        );
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// GET sản phẩm theo khoảng giá
router.get('/filter-by-price', async function (req, res, next) {
    try {
        let { minPrice, maxPrice } = req.query;

        minPrice = parseFloat(minPrice) || 0;
        maxPrice = parseFloat(maxPrice) || Infinity;

        // Tối ưu: dùng aggregate để lọc trong database
        const filteredProducts = await Product.aggregate([
            {
                $match: {
                    status: "active"
                }
            },
            {
                $addFields: {
                    minSalePrice: { $min: "$variations.salePrice" }
                }
            },
            {
                $match: {
                    minSalePrice: { $gte: minPrice, $lte: maxPrice }
                }
            }
        ]);

        res.successResponse(filteredProducts, 'Fetched products within price range successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// GET giá thấp nhất của sản phẩm
router.get('/minprice', async function (req, res, next) {
    try {
        // Tối ưu: dùng aggregate để tính trong database
        const productsWithMinPrice = await Product.aggregate([
            {
                $addFields: {
                    minSalePrice: {
                        $cond: {
                            if: { $gt: [{ $size: "$variations" }, 0] },
                            then: { $min: "$variations.salePrice" },
                            else: null
                        }
                    }
                }
            }
        ]);

        res.successResponse(productsWithMinPrice, 'Fetched all products with min price successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// GET danh sách brands duy nhất
router.get("/brands", async (req, res) => {
    try {
        const brands = await Product.distinct("brand", { status: "active" });
        res.successResponse(brands, "Fetched all active brands successfully");
    } catch (err) {
        res.errorResponse("Failed to fetch brands", 500, {}, { error: err.message });
    }
});

// GET sắp xếp sản phẩm theo tên A-Z hoặc Z-A
router.get('/sort', async function (req, res, next) {
    try {
        const { order, page = 1, limit = 10 } = req.query;
        const sortOrder = order === 'desc' ? -1 : 1;

        const totalProducts = await Product.countDocuments({ status: "active" });
        const products = await Product.find({ status: "active" })
            .sort({ name: sortOrder })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        res.successResponse(
            products,
            `Fetched active products sorted ${sortOrder === 1 ? 'A-Z' : 'Z-A'} successfully`,
            200,
            {
                totalProducts,
                currentPage: parseInt(page),
                pageSize: parseInt(limit),
                totalPages: Math.ceil(totalProducts / parseInt(limit))
            }
        );
    } catch (err) {
        res.errorResponse('Failed to fetch sorted products', 500, {}, { error: err.message });
    }
});

// GET danh sách danh mục
router.get("/categories", async (req, res) => {
    try {
        // Lấy danh sách category ID từ sản phẩm active
        const productCategories = await Product.distinct("category", { status: "active" });

        // Tìm thông tin danh mục tương ứng
        const categories = await ProductCategory.find(
            { _id: { $in: productCategories } },
            { name: 1, _id: 1 }
        ).lean();

        res.successResponse(categories, "Fetched active categories successfully");
    } catch (error) {
        res.errorResponse("Failed to fetch categories", 500, {}, { error: error.message });
    }
});

// GET tất cả sản phẩm không phân trang
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const products = await Product.find().lean();
        res.successResponse(products, 'Fetched all products successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// GET tất cả sản phẩm có phân trang và lọc
router.get('/all', async function (req, res) {
    try {
        const { page = 1, limit = 10, category, priceMin, priceMax, search, sortBy } = req.query;

        const filters = {};

        if (category) {
            filters.category = category;
        }

        if (priceMin || priceMax) {
            filters['variations.salePrice'] = {};
            if (priceMin) filters['variations.salePrice'].$gte = parseInt(priceMin);
            if (priceMax) filters['variations.salePrice'].$lte = parseInt(priceMax);
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filters.$or = [
                { name: searchRegex },
                { category: searchRegex }
            ];
        }

        // Xác định cách sắp xếp
        let sortOption = {};
        if (sortBy === 'priceAsc') {
            sortOption = { 'variations.salePrice': 1 };
        } else if (sortBy === 'priceDesc') {
            sortOption = { 'variations.salePrice': -1 };
        }

        // Đếm tổng số sản phẩm
        const count = await Product.countDocuments(filters);

        // Lấy sản phẩm theo trang
        const products = await Product.find(filters)
            .sort(sortOption)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        res.successResponse(
            { products },
            'Fetched all products successfully',
            200,
            {
                totalProducts: count,
                pageSize: parseInt(limit),
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        );
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// GET sản phẩm với min và max giá
router.get('/minmaxprice', async function (req, res, next) {
    try {
        // Tối ưu: sử dụng aggregate để tính trong database
        const productsWithPrices = await Product.aggregate([
            {
                $addFields: {
                    minSalePrice: {
                        $cond: {
                            if: { $gt: [{ $size: "$variations" }, 0] },
                            then: { $min: "$variations.salePrice" },
                            else: null
                        }
                    },
                    maxSalePrice: {
                        $cond: {
                            if: { $gt: [{ $size: "$variations" }, 0] },
                            then: { $max: "$variations.salePrice" },
                            else: null
                        }
                    }
                }
            }
        ]);

        res.successResponse(productsWithPrices, 'Fetched all products with min and max prices successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// GET tổng stock của sản phẩm
router.get("/stock/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        // Tối ưu: sử dụng aggregate để tính trong database
        const result = await Product.aggregate([
            { $match: { _id: productId } },
            {
                $project: {
                    totalStock: { $sum: "$variations.stock" }
                }
            }
        ]);

        if (!result.length) {
            return res.errorResponse("Sản phẩm không tồn tại", 404);
        }

        res.successResponse({
            productId,
            totalStock: result[0].totalStock
        }, "Fetched product stock successfully");
    } catch (error) {
        console.error("Lỗi khi lấy stock sản phẩm:", error);
        res.errorResponse("Failed to fetch product stock", 500, {}, { error: error.message });
    }
});

// QUAN TRỌNG: Route lấy sản phẩm liên quan PHẢI ĐẶT TRƯỚC route lấy sản phẩm theo ID
router.get('/related/:productId', async function (req, res, next) {
    try {
        const { productId } = req.params;

        // Tìm sản phẩm gốc để lấy category
        const product = await Product.findById(productId);

        if (!product) {
            return res.errorResponse('Product not found', 404);
        }

        // Tìm số lượng sản phẩm có cùng category
        const totalRelatedCount = await Product.countDocuments({
            _id: { $ne: productId },
            category: product.category,
            status: "active"
        });

        // Nếu có ít hơn hoặc bằng 8 sản phẩm, lấy tất cả
        if (totalRelatedCount <= 8) {
            const relatedProducts = await Product.find({
                _id: { $ne: productId },
                category: product.category,
                status: "active"
            })
                .select('_id name avatar variations')
                .lean();

            const formattedProducts = formatProductsResponse(relatedProducts);

            return res.successResponse(
                formattedProducts,
                'Fetched related products successfully',
                200,
                { totalRelated: formattedProducts.length }
            );
        }

        // Nếu có nhiều hơn 8 sản phẩm, lấy 8 sản phẩm ngẫu nhiên
        // Kiểm tra nếu ID là string hay ObjectId
        const idMatch = typeof productId === 'string' && productId.length === 24
            ? { $ne: mongoose.Types.ObjectId(productId) }
            : { $ne: productId };

        const randomRelatedProducts = await Product.aggregate([
            {
                $match: {
                    _id: idMatch,
                    category: product.category,
                    status: "active"
                }
            },
            { $sample: { size: 8 } },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    avatar: 1,
                    variations: 1
                }
            }
        ]);

        const formattedProducts = formatProductsResponse(randomRelatedProducts);

        res.successResponse(
            formattedProducts,
            'Fetched random related products successfully',
            200,
            { totalRelated: formattedProducts.length }
        );
    } catch (err) {
        console.error('Error fetching related products:', err);
        res.errorResponse('Failed to fetch related products', 500, {}, { error: err.message });
    }
});

// ĐẶT CUỐI CÙNG: GET sản phẩm theo ID
router.get('/:id', async function (req, res, next) {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.errorResponse('Product not found', 404);
        }
        res.successResponse(product, 'Fetched product successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch product', 500, {}, { error: err.message });
    }
});

module.exports = router;