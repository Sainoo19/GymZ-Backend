const express = require('express');
const Product = require('../../models/products'); // Assuming you have a Product model
const ProductCategory = require('../../models/productCategories')
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();


// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all products active from database. */
// router.get('/all/active', async function (req, res, next) {
//     try {
//         const products = await Product.find({ status: "active" });
//         res.successResponse(products, 'Fetched all active products successfully');
//     } catch (err) {
//         res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
//     }
// });

router.get('/all/active', async function (req, res, next) {
    try {
        const { categories, brands, priceMin, priceMax, search, sortBy, page = 1, limit = 10 } = req.query;

        const filters = { status: "active" };

        // ✅ Chuẩn hóa category (xử lý nhiều categories, loại bỏ khoảng trắng thừa)
        if (categories) {
            const categoryNames = categories.split(",");
            const matchedCategories = await ProductCategory.find({ name: { $in: categoryNames } }, { _id: 1 });
            const categoryIds = matchedCategories.map(cat => cat._id);
        
            if (categoryIds.length > 0) {
                filters.category = { $in: categoryIds }; // Lọc theo `_id` thay vì tên
            }
        }

        // ✅ Lọc theo brands
        if (brands) {
            filters.brand = { $in: brands.split(",").map(brand => brand.trim()) };
        }

        // ✅ Lọc theo giá
        if (priceMin || priceMax) {
            filters['variations.salePrice'] = {};
            if (priceMin) filters['variations.salePrice'].$gte = parseInt(priceMin);
            if (priceMax) filters['variations.salePrice'].$lte = parseInt(priceMax);
        }

        // ✅ Tìm kiếm theo tên sản phẩm
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filters.name = searchRegex; // Chỉ tìm theo tên, tránh xung đột với category
        }

        // ✅ Sắp xếp theo giá
        let sortOption = {};
        if (sortBy === 'priceAsc') {
            sortOption = { 'variations.salePrice': 1 };
        } else if (sortBy === 'priceDesc') {
            sortOption = { 'variations.salePrice': -1 };
        }

        // ✅ Bước 1: Lấy toàn bộ sản phẩm thỏa mãn bộ lọc
        const allFilteredProducts = await Product.find(filters).sort(sortOption);

        // ✅ Bước 2: Tính tổng số sản phẩm đúng điều kiện để phân trang
        const totalProducts = allFilteredProducts.length;
        const totalPages = Math.ceil(totalProducts / parseInt(limit));

        // ✅ Bước 3: Lấy sản phẩm cho trang hiện tại
        const products = allFilteredProducts.slice((page - 1) * limit, page * limit);

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


//inputPrice
router.get('/filter-by-price', async function (req, res, next) {
    try {
        let { minPrice, maxPrice } = req.query;
        
        // Chuyển đổi minPrice và maxPrice sang số
        minPrice = parseFloat(minPrice) || 0;
        maxPrice = parseFloat(maxPrice) || Infinity;
        
        const products = await Product.find();
        
        // Lọc sản phẩm theo khoảng giá
        const filteredProducts = products.map(product => {
            if (!product.variations || product.variations.length === 0) {
                return { ...product.toObject(), minSalePrice: null };
            }

            const salePrices = product.variations.map(v => v.salePrice);
            const minSalePrice = Math.min(...salePrices);
            
            return {
                ...product.toObject(),
                minSalePrice,
            };
        }).filter(product => 
            product.minSalePrice !== null &&
            product.minSalePrice >= minPrice && 
            product.minSalePrice <= maxPrice
        );

        res.successResponse(filteredProducts, 'Fetched products within price range successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});



//lấy giá thấp nhất của 1 sản phẩm
router.get('/minprice', async function (req, res, next) {
    try {
        const products = await Product.find();

        // Thêm minSalePrice vào mỗi sản phẩm
        const formattedProducts = products.map(product => {
            if (!product.variations || product.variations.length === 0) {
                return { ...product.toObject(), minSalePrice: null };
            }

            const salePrices = product.variations.map(v => v.salePrice);
            return {
                ...product.toObject(),
                minSalePrice: Math.min(...salePrices),
            };
        });

        res.successResponse(formattedProducts, 'Fetched all products with min price successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});




router.get("/brands", async (req, res) => {
    try {
        // Lấy danh sách brand không trùng lặp từ sản phẩm có status "active"
        const brands = await Product.distinct("brand", { status: "active" });

        res.successResponse(brands, "Fetched all active brands successfully");
    } catch (err) {
        res.errorResponse("Failed to fetch brands", 500, {}, { error: err.message });
    }
});

//SORT A-Z and Z-A
router.get('/sort', async function (req, res, next) {
    try {
        const { order } = req.query; // Lấy giá trị từ query parameters
        const sortOrder = order === 'desc' ? -1 : 1; // Nếu order là 'desc' thì sắp xếp từ Z-A, ngược lại A-Z

        const products = await Product.find({ status: "active" }).sort({ name: sortOrder });

        res.successResponse(products, `Fetched active products sorted ${sortOrder === 1 ? 'A-Z' : 'Z-A'} successfully`);
    } catch (err) {
        res.errorResponse('Failed to fetch sorted products', 500, {}, { error: err.message });
    }
});

router.get("/categories", async (req, res) => {
    try {
        // Lấy danh sách category ID từ bảng Product (loại bỏ trùng lặp)
        const productCategories = await Product.distinct("category");

        // Tìm tên danh mục tương ứng từ bảng ProductCategory
        const categories = await ProductCategory.find(
            { _id: { $in: productCategories } },
            { name: 1, _id: 1 } // ✅ Lấy cả ID danh mục
        );
        

        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error });
    }
});


/* GET all products from database with pagination */
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const products = await Product.find();
        res.successResponse(products, 'Fetched all products successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});
// GET all products with filters and pagination
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
                { name: searchRegex }, // Tìm theo tên sản phẩm
                { category: searchRegex } // Tìm theo danh mục sản phẩm
            ];
        }

        // Xác định cách sắp xếp theo giá
        let sortOption = {};
        if (sortBy === 'priceAsc') {
            sortOption = { 'variations.salePrice': 1 }; // Sắp xếp giá tăng dần
        } else if (sortBy === 'priceDesc') {
            sortOption = { 'variations.salePrice': -1 }; // Sắp xếp giá giảm dần
        }

        const products = await Product.find(filters)
            .sort(sortOption) // Thêm sắp xếp
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec();

        const count = await Product.countDocuments(filters);

        res.successResponse({
            products
        }, 'Fetched all products successfully', 200, {
            totalProducts: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
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

module.exports = router;