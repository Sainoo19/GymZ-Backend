const express = require('express');
const Product = require('../../models/products');
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const { authenticate, authorize } = require('../../middlewares/auth');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all products from database with pagination */
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const products = await Product.find();
        res.successResponse(products, 'Fetched all products successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});
// ...existing code...

/* GET optimized product data for card pages with improved performance */
router.get('/all/cardpage', async function (req, res) {
    try {
        const { page = 1, limit = 10, category, priceMin, priceMax, search, sortBy } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build the aggregation pipeline
        const pipeline = [];

        // Match stage (filtering)
        const matchStage = {};

        if (category) {
            matchStage.category = category;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            matchStage.$or = [
                { name: searchRegex },
                { category: searchRegex }
            ];
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Add price filtering if needed
        if (priceMin || priceMax) {
            const priceFilter = {};
            if (priceMin) priceFilter.$gte = parseInt(priceMin);
            if (priceMax) priceFilter.$lte = parseInt(priceMax);

            if (Object.keys(priceFilter).length > 0) {
                pipeline.push({
                    $match: {
                        'variations.salePrice': priceFilter
                    }
                });
            }
        }

        // Add projection to calculate min/max prices and total stock
        pipeline.push({
            $addFields: {
                minPrice: {
                    $min: '$variations.salePrice'
                },
                maxPrice: {
                    $max: '$variations.salePrice'
                },
                totalStock: {
                    $sum: '$variations.stock'
                }
            }
        });

        // Lookup to get category name
        pipeline.push({
            $lookup: {
                from: 'productcategories',  // collection name is usually plural and lowercase
                localField: 'category',
                foreignField: '_id',
                as: 'categoryObj'
            }
        });

        // Unwind the category object
        pipeline.push({
            $unwind: {
                path: '$categoryObj',
                preserveNullAndEmptyArrays: true
            }
        });

        // Sorting
        if (sortBy === 'priceAsc') {
            pipeline.push({ $sort: { minPrice: 1 } });
        } else if (sortBy === 'priceDesc') {
            pipeline.push({ $sort: { minPrice: -1 } });
        } else {
            // Default sort by _id
            pipeline.push({ $sort: { _id: 1 } });
        }

        // Count total documents before pagination
        const countPipeline = [...pipeline];
        countPipeline.push({ $count: 'totalCount' });
        const countResult = await Product.aggregate(countPipeline).exec();
        const count = countResult.length > 0 ? countResult[0].totalCount : 0;

        // Apply pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limitNum });

        // Final projection to only include needed fields
        pipeline.push({
            $project: {
                _id: 1,
                name: 1,
                categoryId: '$category',
                category: '$categoryObj.name',
                avatar: 1,
                minPrice: 1,
                maxPrice: 1,
                totalStock: 1
            }
        });

        // Execute the aggregation with explain option for performance monitoring
        const products = await Product.aggregate(pipeline).exec();

        res.successResponse({
            products: products
        }, 'Fetched card products successfully', 200, {
            totalProducts: count,
            pageSize: limitNum,
            currentPage: pageNum,
            totalPages: Math.ceil(count / limitNum)
        });
    } catch (err) {
        console.error("Error fetching card products:", err);
        res.errorResponse('Failed to fetch card products', 500, {}, { error: err.message });
    }
});



router.get('/minmaxprice/:productId', async function (req, res) {
    try {
        const { productId } = req.params;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }
        // Lấy danh sách biến thể và tìm min/max price
        if (!product.variations || product.variations.length === 0) {
            return res.json({ minPrice: 0, maxPrice: 0, message: "Không có biến thể nào." });
        }

        const prices = product.variations.map(v => v.salePrice);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        return res.json({
            productId: product._id,
            minPrice,
            maxPrice,
            message: "Lấy giá thành công"
        });
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

router.get('/minmaxprice', async function (req, res, next) {
    try {
        const products = await Product.find();

        // Thêm min/max salePrice vào mỗi sản phẩm
        const formattedProducts = products.map(product => {
            if (!product.variations || product.variations.length === 0) {
                return { ...product.toObject(), minSalePrice: null, maxSalePrice: null };
            }

            const salePrices = product.variations.map(v => v.salePrice);
            return {
                ...product.toObject(),
                minSalePrice: Math.min(...salePrices),
                maxSalePrice: Math.max(...salePrices),
            };
        });

        res.successResponse(formattedProducts, 'Fetched all products successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});

// Lấy tổng stock của một sản phẩm dựa trên variations
router.get("/stock/:productId", async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        const totalStock = product.variations.reduce((sum, variation) => sum + (variation.stock || 0), 0);

        res.json({ productId, totalStock });
    } catch (error) {
        console.error("Lỗi khi lấy stock sản phẩm:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});



/* POST create a new product */
router.post("/create", async function (req, res, next) {
    try {
        const newProductId = await generateId("PR");
        const { name, description, category, brand, variations, images, avatar } = req.body;

        const newProduct = new Product({
            _id: newProductId,
            name,
            description,
            category,
            brand,
            variations,
            avatar, // Nhận danh sách loại hàng từ request body
            images,
            status: "active",
        });

        await newProduct.save();
        res.successResponse(newProduct, "Product created successfully");
    } catch (err) {
        console.error("Error creating product:", err);
        res.errorResponse("Failed to create product", 500, {}, { error: err.message });
    }
});

/* PUT update an existing product */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProduct) {
            return res.errorResponse('Product not found', 404);
        }
        res.successResponse(updatedProduct, 'Product updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update product', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing product */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.errorResponse('Product not found', 404);
        }
        res.successResponse(deletedProduct, 'Product deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete product', 500, {}, { error: err.message });
    }
});

/* GET product by id */
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


router.put("/update-stock/:productId", async (req, res) => {
    try {
        const { productId } = req.params;
        const { variations } = req.body;

        // Check if product exists first
        const product = await Product.findById(productId);
        if (!product) {
            return res.errorResponse("Sản phẩm không tồn tại!", 404);  // Return 404 before checking variations
        }

        // Then check if variations data is valid
        if (!variations || !Array.isArray(variations)) {
            return res.errorResponse("Dữ liệu variations không hợp lệ!", 400);
        }

        product.variations.forEach((variation) => {
            // Tìm theo _id thay vì category và theme
            const updatedVariation = variations.find(v =>
                v._id && variation._id && v._id.toString() === variation._id.toString()
            );

            if (updatedVariation) {
                console.log(`Cập nhật stock cho variation ID: ${variation._id}, hiện tại ${variation.stock}, thêm ${Number(updatedVariation.additionalStock)}`);
                variation.stock += Number(updatedVariation.additionalStock || 0);
            }
        });

        // Lưu cập nhật vào database
        await product.save();
        console.log("Cập nhật thành công:", product.variations);

        res.successResponse(product, "Cập nhật stock thành công");
    } catch (error) {
        console.error("Lỗi cập nhật stock:", error);
        res.errorResponse("Lỗi server", 500, {}, { error: error.message });
    }
});
module.exports = router;