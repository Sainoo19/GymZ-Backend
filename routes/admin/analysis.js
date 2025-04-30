const express = require("express");
const Order = require("../../models/orders");
const Product = require("../../models/products");
const ProductCategory = require("../../models/productCategories");
const Member = require("../../models/members");
const Branch = require("../../models/branches");
const MemberBill = require("../../models/memberBill");
const mongoose = require("mongoose");
const { authenticate, authorize } = require("../../middlewares/auth");
const customResponse = require('../../utils/customResponse');
const moment = require("moment");

const router = express.Router();
router.use(customResponse);
const statusOrder = "Đặt hàng thành công";
const statusMember = "ACTIVE";

router.get(
  "/frequently-bought-together",
  authenticate,
  authorize(["admin", "manager"]),
  async (req, res) => {
    try {
      // 1. Lấy ngày giới hạn (10 ngày trước)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 10);
      console.log("sixtyDaysAgo", sixtyDaysAgo);

      // 2. Lọc đơn hàng trong 10 ngày gần nhất
      const orders = await Order.find({ createdAt: { $gte: sixtyDaysAgo } });
      if (!orders.length) {
        return res.json({ recommendations: [] }); // Không có dữ liệu
      }

      // 3. Tạo đối tượng để lưu số lần các sản phẩm xuất hiện cùng nhau
      let productPairs = {};
      let totalCount = 0;
      let totalPairs = 0;

      orders.forEach((order) => {
        console.log("Items in order:", JSON.stringify(order.items, null, 2)); // Log the detailed structure of items

        // Kiểm tra nếu đơn hàng có sản phẩm bị trùng ID thì bỏ qua đơn hàng đó
        const productIds = order.items.map((item) => item.product_id);
        console.log("productIds", productIds);

        const uniqueProductIds = new Set(productIds);
        if (uniqueProductIds.size !== productIds.length) {
          console.log("Skipping order due to duplicate product IDs");
          return; // Bỏ qua đơn hàng này nếu có sản phẩm trùng
        }

        // Duyệt từng cặp sản phẩm trong đơn hàng nếu đơn hàng có từ 2 sản phẩm trở lên
        if (order.items.length > 1) {
          order.items.forEach((itemA, index) => {
            for (let j = index + 1; j < order.items.length; j++) {
              const itemB = order.items[j];

              // Sắp xếp ID để tránh trùng lặp (A_B và B_A giống nhau)
              const key = [itemA.product_id, itemB.product_id].sort().join("_");
              productPairs[key] = (productPairs[key] || 0) + 1;
              totalCount += 1; // Tổng số lần xuất hiện của các cặp
            }
          });
        }

      });
      console.log("totalCount", totalCount);

      console.log("productPairs:", productPairs); // Log the final product pairs object

      totalPairs = Object.keys(productPairs).length;
      const averageCount = totalPairs ? totalCount / totalPairs : 0; // Tính trung bình

      // 4. Chuyển danh sách cặp sản phẩm thành mảng và sắp xếp theo số lần xuất hiện
      let sortedPairs = Object.entries(productPairs)
        .sort((a, b) => b[1] - a[1]) // Sắp xếp theo tần suất xuất hiện
        .map(([key, count]) => {
          const [product1, product2] = key.split("_");
          return { product1, product2, count };
        })
        .filter((pair) => pair.count > averageCount); // Chỉ lấy những cặp sản phẩm có số lần mua lớn hơn trung bình

      // 5. Lấy thông tin chi tiết sản phẩm từ DB
      const recommendations = await Promise.all(
        sortedPairs.map(async ({ product1, product2, count }) => {
          const p1 = await Product.findById(product1);
          const p2 = await Product.findById(product2);
          if (!p1 || !p2) return null;

          return {
            product1: {
              _id: p1._id,
              name: p1.name,
              avatar: p1.avatar,
            },
            product2: {
              _id: p2._id,
              name: p2.name,
              avatar: p2.avatar,
            },
            count,
          };
        })
      );

      // Trả về danh sách sản phẩm thường mua chung, lọc các cặp sản phẩm bị null
      res.json({ recommendations: recommendations.filter(Boolean) });
    } catch (error) {
      console.error("Lỗi khi lấy sản phẩm thường mua cùng:", error);
      res.status(500).json({ error: "Lỗi server" });
    }
  }
);


router.get("/profitByMonth", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // Lấy tất cả đơn hàng hoàn thành trong năm hiện tại
    const orders = await Order.find({
      status: statusOrder,
      createdAt: {
        $gte: new Date(`${currentYear}-01-01`), // Từ ngày 1/1 của năm hiện tại
        $lt: new Date(`${currentYear + 1}-01-01`), // Trước ngày 1/1 của năm sau
      },
    });

    // Khởi tạo lợi nhuận cho từng tháng (đảm bảo đủ 12 tháng)
    let monthlyProfit = Array(12).fill(0);

    // Lấy tất cả ID sản phẩm và nhóm lại để tối ưu truy vấn
    let productIds = new Set();
    orders.forEach((order) => {
      order.items.forEach((item) => productIds.add(item.product_id));
    });

    // Lấy toàn bộ sản phẩm liên quan để tránh query trong vòng lặp
    const products = await Product.find(
      { _id: { $in: [...productIds] } },
      { _id: 1, variations: 1 } // Chỉ lấy các field cần thiết
    );

    const productMap = new Map();
    products.forEach((product) => {
      productMap.set(product._id.toString(), product.variations);
    });

    // Tính lợi nhuận theo tháng
    for (const order of orders) {
      const month = new Date(order.createdAt).getMonth(); // Lấy tháng (0 - 11)

      for (const item of order.items) {
        const variations = productMap.get(item.product_id.toString());
        if (!variations) continue;

        const variation = variations.find((v) => v.category === item.category);
        if (!variation) continue;

        const costPrice = variation.costPrice || 0;
        const salePrice = variation.salePrice || 0;
        const profit = (salePrice - costPrice) * item.quantity;

        monthlyProfit[month] += profit;
      }
    }

    res.json({ success: true, profitByMonth: monthlyProfit });
  } catch (error) {
    console.error("Error fetching profit statistics:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/profitOrders", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const orders = await Order.aggregate([
      {
        $match: { status: statusOrder }, // Chỉ lấy đơn hàng đã hoàn thành
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" }, // Tính tổng doanh thu theo tháng
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }, // Sắp xếp theo tháng
      },
    ]);

    const formattedData = orders.map((order) => ({
      month: `${order._id.year}-${order._id.month.toString().padStart(2, "0")}`,
      totalOrders: order.totalOrders,
      totalRevenue: order.totalRevenue,
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Error fetching order statistics:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
const getMonthlyRevenue = async (year) => {
  const revenue = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
        status: statusOrder, // Chỉ lấy đơn hàng đã thanh toán
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        totalRevenue: { $sum: "$totalPrice" },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);

  // Mảng mặc định có đủ 12 tháng
  const formattedRevenue = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    year,
    revenue: 0,
  }));

  // Cập nhật doanh thu nếu có dữ liệu
  revenue.forEach((item) => {
    formattedRevenue[item._id.month - 1].revenue = item.totalRevenue;
  });

  return formattedRevenue;
};

// API lấy doanh thu tháng hiện tại và tháng trước
router.get("/revenue", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1 = Jan, 12 = Dec

    // Lấy doanh thu của năm hiện tại
    const revenueData = await getMonthlyRevenue(currentYear);

    // Doanh thu tháng hiện tại
    const currentMonthData = revenueData.find(
      (item) => item.month === currentMonth
    ) || { revenue: 0 };
    const currentMonthRevenue = currentMonthData.revenue;

    // Doanh thu tháng trước
    let previousMonthRevenue = 0;
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;

    if (currentMonth === 1) {
      previousMonth = 12;
      previousYear = currentYear - 1;
      const lastYearRevenue = await getMonthlyRevenue(previousYear);
      previousMonthRevenue =
        lastYearRevenue.find((item) => item.month === previousMonth)?.revenue ||
        0;
    } else {
      previousMonthRevenue =
        revenueData.find((item) => item.month === previousMonth)?.revenue || 0;
    }

    // Tính phần trăm tăng trưởng so với tháng trước
    let growthRate =
      previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) /
          previousMonthRevenue) *
        100
        : 0;

    res.json({
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        revenue: currentMonthRevenue,
      },
      previousMonth: {
        month: previousMonth,
        year: previousYear,
        revenue: previousMonthRevenue,
      },
      comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`,
      growthRate: growthRate.toFixed(2),
      revenueByMonth: revenueData,
    });
  } catch (error) {
    console.error("Lỗi khi lấy doanh thu:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

const getMonthlyProfit = async (year) => {
  // Tạo bộ lọc để chỉ lấy đơn hàng trong năm
  const yearFilter = {
    status: statusOrder,
    createdAt: {
      $gte: new Date(`${year}-01-01T00:00:00.000Z`),
      $lte: new Date(`${year}-12-31T23:59:59.999Z`),
    }
  };

  // Lấy đơn hàng và thông tin cần thiết
  const orders = await Order.find(yearFilter)
    .select('createdAt items')
    .lean();

  // Mảng chứa lợi nhuận theo tháng
  let monthlyProfit = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    year,
    profit: 0,
  }));

  // Lấy danh sách các product_id duy nhất từ orders
  const productIds = [...new Set(
    orders.flatMap(order => order.items.map(item => item.product_id))
  )];

  // Tạo map để lưu trữ biến thể của sản phẩm - tối ưu bằng cách chỉ truy vấn DB một lần
  const productVariationsMap = {};

  // Lấy tất cả sản phẩm liên quan cùng lúc
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id variations')
    .lean();

  // Xây dựng map thông tin biến thể
  products.forEach(product => {
    productVariationsMap[product._id] = product.variations;
  });

  // Tính lợi nhuận
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    const month = orderDate.getMonth(); // 0-indexed (0 = January)

    for (const item of order.items) {
      const variations = productVariationsMap[item.product_id];
      if (!variations) continue;

      const variation = variations.find(v =>
        v.category === item.category &&
        (v.theme === item.theme || (!v.theme && !item.theme))
      );

      if (!variation) continue;

      const costPrice = variation.costPrice || 0;
      const salePrice = variation.salePrice || 0;
      const profit = (salePrice - costPrice) * item.quantity;

      monthlyProfit[month].profit += profit;
    }
  }

  return monthlyProfit;
};

// API lấy lợi nhuận tháng hiện tại và tháng trước
router.get("/profit", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // Sử dụng cache nếu có thể - ví dụ với Redis

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Lấy lợi nhuận theo tháng của năm hiện tại - sử dụng hàm đã tối ưu
    const profitData = await getMonthlyProfit(currentYear);

    // Lợi nhuận tháng hiện tại
    const currentMonthProfit =
      profitData.find((item) => item.month === currentMonth)?.profit || 0;

    // Lợi nhuận tháng trước
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    let previousMonthProfit = 0;

    if (currentMonth === 1) {
      previousMonth = 12;
      previousYear = currentYear - 1;
      const lastYearProfit = await getMonthlyProfit(previousYear);
      previousMonthProfit =
        lastYearProfit.find((item) => item.month === previousMonth)?.profit || 0;
    } else {
      previousMonthProfit =
        profitData.find((item) => item.month === previousMonth)?.profit || 0;
    }

    // Tính phần trăm tăng trưởng lợi nhuận so với tháng trước
    let growthRate =
      previousMonthProfit > 0
        ? ((currentMonthProfit - previousMonthProfit) / previousMonthProfit) * 100
        : 0;

    res.json({
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        profit: currentMonthProfit,
      },
      previousMonth: {
        month: previousMonth,
        year: previousYear,
        profit: previousMonthProfit,
      },
      comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`,
      growthRate: growthRate.toFixed(2),
      profitByMonth: profitData,
    });
  } catch (error) {
    console.error("Lỗi khi lấy lợi nhuận:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

router.get("/revenueByMonth", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const orders = await Order.find({
      status: statusOrder, // Chỉ lấy đơn hàng đã hoàn thành
      createdAt: {
        $gte: new Date(`${currentYear}-01-01`),
        $lt: new Date(`${currentYear + 1}-01-01`),
      },
    });

    // Khởi tạo doanh thu từng tháng (mặc định 0)
    let revenueByMonth = Array(12)
      .fill(0)
      .map((_, index) => ({
        month: index + 1,
        year: currentYear,
        revenue: 0,
      }));

    // Tính tổng doanh thu theo tháng
    orders.forEach((order) => {
      const month = new Date(order.createdAt).getMonth(); // Lấy tháng (0-11)
      revenueByMonth[month].revenue += order.totalPrice;
    });

    // Sắp xếp dữ liệu theo tháng
    revenueByMonth.sort((a, b) => a.month - b.month);

    // Tính toán doanh thu tháng hiện tại và tháng trước
    const currentMonthIndex = new Date().getMonth();
    const currentMonthRevenue = revenueByMonth[currentMonthIndex] || {
      revenue: 0,
    };
    const previousMonthRevenue = revenueByMonth[currentMonthIndex - 1] || {
      revenue: 0,
    };

    // Tính % tăng trưởng
    const growthRate = previousMonthRevenue.revenue
      ? (
        ((currentMonthRevenue.revenue - previousMonthRevenue.revenue) /
          previousMonthRevenue.revenue) *
        100
      ).toFixed(2)
      : "0";

    // Chuẩn bị dữ liệu phản hồi
    const responseData = {
      currentMonth: currentMonthRevenue,
      previousMonth: previousMonthRevenue,
      comparisonText: `So với tháng ${previousMonthRevenue.month} năm ${previousMonthRevenue.year}`,
      growthRate,
      revenueByMonth,
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error("Lỗi khi lấy doanh thu hàng tháng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

// Thêm hàm này trước khi sử dụng ở route /orderStats
const getMonthlyOrders = async (year) => {
  // Sử dụng aggregation để tối ưu hiệu suất
  const orders = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
        status: statusOrder
      }
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { "_id.month": 1 } }
  ]);

  // Tạo mảng kết quả với đầy đủ 12 tháng
  const formattedOrders = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    year,
    totalOrders: 0
  }));

  // Điền dữ liệu vào các tháng có đơn hàng
  orders.forEach(item => {
    formattedOrders[item._id.month - 1].totalOrders = item.totalOrders;
  });

  return formattedOrders;
};

// API lấy số đơn hàng tháng hiện tại và tháng trước
router.get("/orderStats", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Lấy số đơn hàng theo tháng của năm hiện tại
    const orderData = await getMonthlyOrders(currentYear);

    // Số đơn hàng tháng hiện tại
    const currentMonthOrders =
      orderData.find((item) => item.month === currentMonth)?.totalOrders || 0;

    // Số đơn hàng tháng trước
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    let previousMonthOrders = 0;

    if (currentMonth === 1) {
      previousMonth = 12;
      previousYear = currentYear - 1;
      const lastYearOrders = await getMonthlyOrders(previousYear);
      previousMonthOrders =
        lastYearOrders.find((item) => item.month === previousMonth)
          ?.totalOrders || 0;
    } else {
      previousMonthOrders =
        orderData.find((item) => item.month === previousMonth)?.totalOrders ||
        0;
    }

    // Tính phần trăm tăng trưởng số đơn hàng so với tháng trước
    let growthRate =
      previousMonthOrders > 0
        ? ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) *
        100
        : 0;

    res.json({
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        totalOrders: currentMonthOrders,
      },
      previousMonth: {
        month: previousMonth,
        year: previousYear,
        totalOrders: previousMonthOrders,
      },
      comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`,
      growthRate: growthRate.toFixed(2),
      ordersByMonth: orderData,
    });
  } catch (error) {
    console.error("Lỗi khi lấy số đơn hàng:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

router.get("/best-selling-products", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // 1. Sử dụng aggregation để tính số lượng bán của từng sản phẩm/biến thể
    const productSales = await Order.aggregate([
      { $match: { status: statusOrder } },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            product_id: "$items.product_id",
            category: "$items.category",
            theme: { $ifNull: ["$items.theme", "no-theme"] }
          },
          soldCount: { $sum: "$items.quantity" },
          avatar: { $first: "$items.avatar" }
        }
      },
      { $sort: { soldCount: -1 } }
    ]);

    // 2. Lấy danh sách các ID sản phẩm duy nhất
    const productIds = [...new Set(productSales.map(item => item._id.product_id))];

    // 3. Lấy tất cả thông tin sản phẩm cần thiết trong một lần truy vấn
    const products = await Product.find(
      { _id: { $in: productIds } },
      { _id: 1, name: 1, price: 1, avatar: 1 }
    ).lean();

    // 4. Tạo map để truy cập thông tin sản phẩm nhanh hơn
    const productMap = {};
    products.forEach(product => {
      productMap[product._id] = product;
    });

    // 5. Kết hợp dữ liệu cho phản hồi
    const bestSellingProducts = productSales
      .filter(item => productMap[item._id.product_id]) // Chỉ giữ lại các sản phẩm tồn tại
      .map(item => {
        const product = productMap[item._id.product_id];
        return {
          _id: product._id,
          name: product.name,
          category: item._id.category,
          theme: item._id.theme !== "no-theme" ? item._id.theme : null,
          soldCount: item.soldCount,
          price: product.price,
          avatar: product.avatar || item.avatar
        };
      });

    res.json({
      success: true,
      bestSellingProducts,
      totalProducts: bestSellingProducts.length
    });

  } catch (error) {
    console.error("Lỗi khi lấy sản phẩm bán chạy nhất:", error);
    res.status(500).json({ success: false, message: "Lỗi server!" });
  }
});

const getRevenueByMonth = async (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const orders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: statusOrder,
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalPrice" },
      },
    },
  ]);

  return orders.length > 0 ? orders[0].totalRevenue : 0;
};

// Lấy số lượng bán ra của từng sản phẩm theo tháng
const getProductSalesByMonth = async (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const productSales = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: statusOrder,
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product_id",
        totalQuantity: { $sum: "$items.quantity" },
      },
    },
  ]);

  return productSales.reduce((acc, item) => {
    acc[item._id] = item.totalQuantity;
    return acc;
  }, {});
};

// API phân tích doanh thu & gợi ý chiến lược bán hàng
router.get("/revenue-suggestions", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // Tháng hiện tại
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;

    // Lấy doanh thu tháng này và tháng trước
    const currentRevenue = await getRevenueByMonth(year, month);
    const lastMonthRevenue = await getRevenueByMonth(
      previousYear,
      previousMonth
    );

    // Lấy số lượng bán ra của từng sản phẩm
    const currentProductSales = await getProductSalesByMonth(year, month);
    const lastMonthProductSales = await getProductSalesByMonth(
      previousYear,
      previousMonth
    );

    let suggestions = [];

    // Nếu doanh thu giảm so với tháng trước
    if (currentRevenue < lastMonthRevenue) {
      suggestions.push(
        "Doanh thu tháng này giảm so với tháng trước. Hãy đẩy mạnh quảng cáo và triển khai các chương trình khuyến mãi."
      );
    }

    // Phát hiện sản phẩm bán chậm hoặc giảm doanh số
    const products = await Product.find();
    products.forEach((product) => {
      const currentSales = currentProductSales[product._id] || 0;
      const lastMonthSales = lastMonthProductSales[product._id] || 0;
      console.log(
        `📊 ${product.name}: Tháng trước: ${lastMonthSales}, Tháng này: ${currentSales}`
      );

      if (lastMonthSales > 0 && currentSales / lastMonthSales <= 0.2) {
        suggestions.push(
          `Sản phẩm ${product._id}: ${product.name} có doanh số giảm mạnh. Hãy thử giảm giá, chạy quảng cáo hoặc bán kèm sản phẩm khác.`
        );
      } else if (currentSales === 0 && lastMonthSales > 0) {
        suggestions.push(
          `Sản phẩm ${product.name} đã không bán được trong tháng này. Hãy kiểm tra lại chiến lược bán hàng hoặc thử chương trình giảm giá.`
        );
      }
    });

    res.json({
      success: true,
      currentRevenue,
      lastMonthRevenue,
      revenueChange: currentRevenue - lastMonthRevenue,
      suggestions,
    });
  } catch (error) {
    console.error("Lỗi phân tích doanh thu:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi phân tích doanh thu" });
  }
});

router.get("/inventory", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const products = await Product.find({}, "name variations");
    res.json({ success: true, inventory: products });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách hàng tồn kho:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi khi lấy danh sách hàng tồn kho" });
  }
});
router.get("/inventory-report", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    // Lấy danh sách sản phẩm
    const products = await Product.find(filter).select(
      "name category variations avatar"
    );

    // Lấy danh mục để ánh xạ _id → name
    const categories = await ProductCategory.find().select("_id name");
    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat._id] = cat.name;
      return acc;
    }, {});

    const inventoryList = products.map((product) => {
      const totalStock = product.variations.reduce(
        (sum, variation) => sum + variation.stock,
        0
      );

      return {
        productId: product._id,
        avatar: product.avatar,
        name: product.name,
        category: categoryMap[product.category] || "Không xác định", // Hiển thị tên danh mục
        totalStock,
        variations: product.variations.map((variation) => ({
          theme: variation.theme || "N/A",
          category: variation.category || "N/A",
          stock: variation.stock,
        })),
      };
    });

    res.json({
      success: true,
      totalProducts: inventoryList.length,
      inventory: inventoryList,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách hàng tồn kho:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy hàng tồn kho" });
  }
});
router.get("/products-inventory/:id", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm theo ID
    const product = await Product.findById(id).select(
      "name category variations avatar price brand"
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    // Lấy danh mục để ánh xạ _id → name
    const category = await ProductCategory.findById(product.category).select(
      "name"
    );

    // Tính tổng số lượng tồn kho từ tất cả biến thể
    const totalStock = product.variations.reduce(
      (sum, variation) => sum + variation.stock,
      0
    );

    // Chuẩn bị dữ liệu trả về
    const productDetail = {
      productId: product._id,
      avatar: product.avatar,
      name: product.name,
      category: category ? category.name : "Không xác định",
      price: product.price,
      brand: product.brand,
      totalStock,
      variations: product.variations.map((variation) => ({
        theme: variation.theme || "N/A",
        category: variation.category || "N/A",
        stock: variation.stock,
      })),
    };

    res.json({ success: true, product: productDetail });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy sản phẩm" });
  }
});

const predictStockNeeded = (salesHistory, currentStock) => {
  if (!Array.isArray(salesHistory) || salesHistory.length === 0) return 0;

  const avgSalesPerDay =
    salesHistory.reduce((a, b) => a + b, 0) / salesHistory.length;
  const predictedDemand = avgSalesPerDay * 30; // Dự đoán nhu cầu trong 30 ngày

  let stockNeeded = predictedDemand - currentStock;

  // Điều chỉnh giảm lượng nhập nếu tồn kho quá nhiều
  if (currentStock >= predictedDemand * 2) {
    stockNeeded *= 0.5; // Giảm 50%
  } else if (currentStock >= predictedDemand * 1.5) {
    stockNeeded *= 0.7; // Giảm 70%
  }

  return Math.max(Math.ceil(stockNeeded), 0);
};

// API lấy danh sách sản phẩm và dự đoán số lượng cần nhập cho từng biến thể
router.get("/predict-stock", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const products = await Product.find().lean();
    let stockPredictions = [];

    for (let product of products) {
      for (let variation of product.variations) {
        // Lấy danh sách đơn hàng chứa biến thể này
        const orders = await Order.find({
          "items.product_id": product._id,
        }).lean();

        // Lọc đơn hàng trong 30 ngày gần nhất
        const salesHistory = {};
        const today = new Date();
        const past30Days = new Date(today);
        past30Days.setDate(today.getDate() - 30);

        orders.forEach((order) => {
          const orderDate = new Date(order.createdAt);
          if (orderDate >= past30Days) {
            order.items.forEach((item) => {
              if (
                item.product_id.toString() === product._id.toString() &&
                item.category === variation.category &&
                item.theme === variation.theme
              ) {
                const dateKey = orderDate.toISOString().split("T")[0]; // YYYY-MM-DD
                salesHistory[dateKey] =
                  (salesHistory[dateKey] || 0) + item.quantity;
              }
            });
          }
        });

        // Chuyển salesHistory thành mảng số lượng bán theo ngày
        const salesData = Object.values(salesHistory);
        const totalSold = salesData.reduce((sum, num) => sum + num, 0);
        const currentStock = variation.stock;

        // Dự đoán số lượng cần nhập cho từng biến thể
        let stockNeeded = predictStockNeeded(salesData, currentStock);

        // Giảm dự đoán nếu tồn kho quá cao so với doanh số
        if (currentStock > totalSold * 3) {
          stockNeeded = Math.ceil(stockNeeded * 0.5);
        }

        stockPredictions.push({
          productId: product._id,
          name: product.name,
          category: variation.category,
          theme: variation.theme || "Không có",
          totalSold,
          currentStock,
          stockNeeded,
        });
      }
    }

    // Sắp xếp theo số lượng cần nhập giảm dần
    stockPredictions.sort((a, b) => b.stockNeeded - a.stockNeeded);

    res.json({ status: "success", data: stockPredictions });
  } catch (error) {
    console.error("Lỗi khi dự đoán số lượng cần nhập:", error);
    res.status(500).json({ status: "error", message: "Lỗi máy chủ" });
  }
});

router.get("/memberStats", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1; // Tháng hiện tại
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1; // Tháng trước
    const previousYear = currentMonth === 1 ? new Date().getFullYear() - 1 : new Date().getFullYear(); // Năm trước nếu là tháng 1

    // Lấy danh sách hội viên còn hiệu lực (status là ACTIVE và validUntil còn hiệu lực)
    const members = await Member.find({
      status: "ACTIVE",
      $or: [
        { validUntil: { $gte: new Date() } },  // Kiểm tra validUntil hợp lệ
        { validUntil: null }                   // Hoặc validUntil null
      ]
    });

    // Tính tổng số hội viên
    const totalActiveMembers = members.length;

    // Tính số lượng hội viên đăng ký trong tháng trước
    const previousMonthMembers = await Member.countDocuments({
      status: "ACTIVE",
      $or: [
        { validUntil: { $gte: new Date(new Date().setMonth(previousMonth - 1)) } },  // Kiểm tra validUntil hợp lệ cho tháng trước
      ],
      registerDate: {
        $gte: new Date(previousYear, previousMonth - 1, 1), // Ngày bắt đầu của tháng trước
        $lt: new Date(previousYear, previousMonth, 1)       // Ngày bắt đầu của tháng hiện tại
      }
    });

    // Phần trăm tăng trưởng nếu có
    let growthRate = 0;
    if (previousMonthMembers > 0) {
      growthRate = ((totalActiveMembers - previousMonthMembers) / previousMonthMembers) * 100;
    }

    res.json({
      totalActiveMembers: totalActiveMembers,
      message: `Tổng số hội viên hoạt động hiện tại: ${totalActiveMembers}`,
      comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`,
      growthRate: growthRate.toFixed(2), // Hiển thị phần trăm tăng trưởng
    });
  } catch (error) {
    console.error("Lỗi khi lấy thống kê hội viên:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});


router.get("/count-by-type", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const today = new Date();
    const branchID = req.query.branchID;

    // Tạo bộ lọc động
    const matchStage = {
      status: statusMember,
      $or: [{ validUntil: { $gte: today } }],
    };

    // Nếu có branchID và không phải "ALL", thêm vào filter
    if (branchID && branchID !== "ALL") {
      matchStage.branchID = branchID;
    }

    const membersCount = await Member.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const defaultTypes = Member.schema.path("type").enumValues;
    const result = defaultTypes.map((type) => ({
      type,
      count: membersCount.find((item) => item._id === type)?.count || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching members count:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
router.get("/getbranches", async (req, res) => {
  try {
    const branches = await Branch.find({}, { _id: 1, name: 1 });
    res.json(branches); // Trả về tất cả branch
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
router.get('/member-distribution', async (req, res) => {
  try {
    const { branchID } = req.query;
    const filters = {
      status: statusMember,
      $or: [
        { validUntil: null }, // Trường hợp không có hạn, vẫn hợp lệ
        { validUntil: { $gte: new Date() } } // validUntil phải >= ngày hiện tại
      ]
    };

    if (branchID) {
      filters.branchID = branchID;
    }

    const memberDistribution = await Member.aggregate([
      { $match: filters },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const result = memberDistribution.map(item => ({
      label: item._id,
      value: item.count
    }));

    res.status(200).json({
      message: 'Member distribution fetched successfully',
      data: result
    });

  } catch (err) {
    console.error("Error in /member-distribution:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});



// API: GET /api/revenue-by-month
router.get("/revenue-member-by-month", async (req, res) => {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 12);

    const bills = await MemberBill.aggregate([
      {
        $lookup: {
          from: 'members',
          localField: 'memberID',
          foreignField: '_id',
          as: 'member'
        }
      },
      { $unwind: '$member' },
      {
        $match: {
          'member.validUntil': {
            $gte: today,
            $lte: futureDate
          }
        }
      },
      {
        $project: {
          amount: 1,
          validFrom: '$member.validFrom',
          validUntil: '$member.validUntil',
          type: '$member.type'
        }
      }
    ]);

    const monthlyMap = {};

    bills.forEach(bill => {
      const { amount, validFrom, validUntil, type } = bill;
      if (!validFrom || !validUntil || !type) return;

      const start = new Date(validFrom);
      const end = new Date(validUntil);
      const months = [];

      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
        months.push(monthKey);
        current.setMonth(current.getMonth() + 1);
      }

      const amountPerMonth = amount / months.length;

      months.forEach(month => {
        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            typeRevenue: {},
            totalRevenue: 0
          };
        }

        if (!monthlyMap[month].typeRevenue[type]) {
          monthlyMap[month].typeRevenue[type] = 0;
        }

        monthlyMap[month].typeRevenue[type] += amountPerMonth;
        monthlyMap[month].totalRevenue += amountPerMonth;
      });
    });

    const result = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      typeRevenue: Object.fromEntries(
        Object.entries(data.typeRevenue).map(([type, value]) => [type, Math.round(value)])
      ),
      totalRevenue: Math.round(data.totalRevenue)
    }));

    result.sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      status: 'success',
      data: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});






module.exports = router;
