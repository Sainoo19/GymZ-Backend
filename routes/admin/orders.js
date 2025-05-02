const express = require("express");
const Order = require("../../models/orders"); // Assuming you have an Order model
const Product = require("../../models/products");
const customResponse = require("../../utils/customResponse");
const generateId = require("../../utils/generateId");
const Review = require("../../models/reviews");
const router = express.Router();
const { db, admin } = require("../../config/firebase"); // Import Firestore
const {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} = require("firebase/firestore"); // Correctly import Firestore

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all orders from database with pagination and filters */
router.get("/all", async function (req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      user_id,
      status,
      startDate,
      endDate,
      minTotalPrice,
      maxTotalPrice,
      product_id,
      search,
    } = req.query;

    const filters = {};

    if (user_id) {
      filters.user_id = user_id;
    }

    if (status) {
      filters.status = status;
    }

    if (startDate && endDate) {
      filters.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (minTotalPrice || maxTotalPrice) {
      filters.totalPrice = {};
      if (minTotalPrice) filters.totalPrice.$gte = parseFloat(minTotalPrice);
      if (maxTotalPrice) filters.totalPrice.$lte = parseFloat(maxTotalPrice);
    }

    if (product_id) {
      filters["items.product_id"] = product_id;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i"); // Tạo biểu thức chính quy không phân biệt hoa thường
      filters.$or = [
        { _id: searchRegex }, // Tìm kiếm theo orderID
        { user_id: searchRegex }, // Tìm kiếm theo userID
      ];
    }

    const orders = await Order.find(filters)
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo mới nhất

      .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
      .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
      .exec();

    const count = await Order.countDocuments(filters);

    res.successResponse(
      {
        orders,
      },
      "Fetched all orders successfully",
      200,
      {
        totalOrders: count,
        pageSize: parseInt(limit),
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
      }
    );
  } catch (err) {
    res.errorResponse(
      "Failed to fetch orders",
      500,
      {},
      { error: err.message }
    );
  }
});

/* POST create a new order */
router.post("/create", async function (req, res, next) {
  try {
    const newOrderId = await generateId("ORD");
    const newOrder = new Order({
      _id: newOrderId,
      ...req.body,
    });
    await newOrder.save();
    res.successResponse(newOrder, "Order created successfully");
  } catch (err) {
    res.errorResponse(
      "Failed to create order",
      500,
      {},
      { error: err.message }
    );
  }
});

/* PUT update an existing order */
router.put("/update/:id", async function (req, res, next) {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedOrder) {
      return res.errorResponse("Order not found", 404);
    }
    console.log("🧐 Querying notifications for orderId:", req.params.id);

    try {
      // Truy vấn Firestore với Admin SDK
      const notiRef = db.collection("notifications"); // Sử dụng db từ Admin SDK
      const notiQuery = notiRef.where("orderId", "==", String(req.params.id));

      const notiSnapshot = await notiQuery.get(); // Dùng get() để lấy dữ liệu
      console.log("📜 Number of notifications found:", notiSnapshot.size);

      // Xóa thông báo
      console.log(
        "🔍 Notifications to delete:",
        notiSnapshot.docs.map((doc) => doc.id)
      );

      for (const noti of notiSnapshot.docs) {
        console.log("🗑 Deleting notification:", noti.id);
        await noti.ref.delete(); // Sử dụng noti.ref.delete() để xóa
      }

      res.successResponse(updatedOrder, "Order updated successfully");
    } catch (error) {
      console.error("❌ Firestore query error:", error);
      res.errorResponse(
        "Failed to query notifications",
        500,
        {},
        { error: error.message }
      );
    }

    // Xóa thông báo trong Firestore
  } catch (err) {
    res.errorResponse(
      "Failed to update order",
      500,
      {},
      { error: err.message }
    );
  }
});

/* DELETE remove an existing order */
router.delete("/delete/:id", async function (req, res, next) {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) {
      return res.errorResponse("Order not found", 404);
    }
    res.successResponse(deletedOrder, "Order deleted successfully");
  } catch (err) {
    res.errorResponse(
      "Failed to delete order",
      500,
      {},
      { error: err.message }
    );
  }
});

/* GET order by id */
router.get("/:id", async function (req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.errorResponse("Order not found", 404);
    }
    res.successResponse(order, "Fetched order successfully");
  } catch (err) {
    res.errorResponse("Failed to fetch order", 500, {}, { error: err.message });
  }
});

/* POST get products by IDs */
router.post("/products/byIds", async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return res.errorResponse("Invalid input, expected an array of IDs", 400);
  }

  try {
    const products = await Product.find({ _id: { $in: ids } });
    res.successResponse(products, "Fetched products successfully");
  } catch (error) {
    console.error("Error fetching products:", error);
    res.errorResponse(
      "Internal server error",
      500,
      {},
      { error: error.message }
    );
  }
});
/* GET all orders */
router.get("/all/nopagination", async function (req, res, next) {
  try {
    const orders = await Order.find();
    res.successResponse(orders, "Fetched all orders successfully");
  } catch (err) {
    res.errorResponse(
      "Failed to fetch orders",
      500,
      {},
      { error: err.message }
    );
  }
});

// Enhanced top-seller API with detailed product information
router.get("/products/top", async (req, res) => {
  try {
    const limit = 8; // Giới hạn số lượng sản phẩm

    // Dùng một pipeline aggregation thay vì nhiều truy vấn
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product_id",
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products", // Collection name (thường là tên model nhưng viết thường số nhiều)
          localField: "_id",
          foreignField: "_id",
          as: "productDetail"
        }
      },
      { $unwind: "$productDetail" },
      {
        $lookup: {
          from: "reviews",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$product_id", "$$productId"] },
                    { $eq: ["$status", "active"] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 }
              }
            }
          ],
          as: "ratingData"
        }
      },
      {
        $project: {
          _id: "$productDetail._id",
          name: "$productDetail.name",
          variations: "$productDetail.variations",
          avatar: "$productDetail.avatar",
          images: "$productDetail.images",
          quantitySold: "$totalQuantity",
          rating: { $ifNull: [{ $arrayElemAt: ["$ratingData.averageRating", 0] }, 0] },
          reviewCount: { $ifNull: [{ $arrayElemAt: ["$ratingData.totalReviews", 0] }, 0] }
        }
      }
    ]);

    // Xử lý dữ liệu cuối cùng (price range và format)
    const enhancedProducts = topProducts.map(product => {
      // Tính giá thấp nhất và cao nhất
      let minPrice = Infinity;
      let maxPrice = 0;

      if (product.variations && product.variations.length) {
        product.variations.forEach(variation => {
          const price = variation.salePrice;
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        });
      }

      // Format giá
      const priceRange = minPrice === maxPrice
        ? `${minPrice}`
        : `${minPrice}-${maxPrice}`;

      // Lấy hình ảnh đầu tiên
      const image = product.avatar || (product.images && product.images.length > 0 ? product.images[0] : "");

      // Format rating
      const formattedRating = parseFloat((product.rating || 0).toFixed(1));

      return {
        _id: product._id,
        name: product.name,
        priceRange: priceRange,
        image: image,
        rating: formattedRating,
        reviewCount: product.reviewCount || 0,
        quantitySold: product.quantitySold || 0
      };
    });

    res.successResponse(
      enhancedProducts,
      "Fetched top selling products successfully"
    );
  } catch (error) {
    console.error("Error fetching top selling products:", error);
    res.errorResponse(
      "Failed to fetch top products",
      500,
      {},
      { error: error.message }
    );
  }
});

module.exports = router;
