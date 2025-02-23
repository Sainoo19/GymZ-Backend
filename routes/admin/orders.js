const express = require("express");
const Order = require("../../models/orders"); // Assuming you have an Order model
const Product = require("../../models/products");
const customResponse = require("../../utils/customResponse");
const generateId = require("../../utils/generateId");
const router = express.Router();

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
    res.successResponse(updatedOrder, "Order updated successfully");
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

/* GET top product page home chưa có làmmmmm*/
router.get("/products/top", async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: "$items" }, // Tách từng sản phẩm trong items thành một document riêng
      {
        $group: {
          _id: "$items.product_id",
          totalQuantity: { $sum: "$items.quantity" }, // Tính tổng quantity của mỗi sản phẩm
        //   orders: { $push: "$_id" }
        },
      },
      { $sort: { totalQuantity: -1 } }, // Sắp xếp giảm dần theo tổng quantity
      { $limit: 8 }, // Giới hạn chỉ lấy 8 sản phẩm
    ]);

    if (topProducts.length === 0) {
      return res
        .status(404)
        .json({ status: "error", code: 404, message: "No products found" });
    }

    res.status(200).json(topProducts);
  } catch (error) {
    console.error("Lỗi khi lấy sản phẩm có số lượng cao nhất:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
module.exports = router;
