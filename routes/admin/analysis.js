const express = require("express");
const Order = require("../../models/orders");
const Product = require("../../models/products");
const ProductCategory = require("../../models/productCategories");
const mongoose = require("mongoose");

const router = express.Router();
const statusOrder = "Đã thanh toán"
router.get("/profitByMonth", async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        
        // Lấy tất cả đơn hàng hoàn thành trong năm hiện tại
        const orders = await Order.find({
            status: statusOrder,
            createdAt: {
                $gte: new Date(`${currentYear}-01-01`), // Từ ngày 1/1 của năm hiện tại
                $lt: new Date(`${currentYear + 1}-01-01`) // Trước ngày 1/1 của năm sau
            }
        });

        // Khởi tạo lợi nhuận cho từng tháng (đảm bảo đủ 12 tháng)
        let monthlyProfit = Array(12).fill(0);

        // Lấy tất cả ID sản phẩm và nhóm lại để tối ưu truy vấn
        let productIds = new Set();
        orders.forEach(order => {
            order.items.forEach(item => productIds.add(item.product_id));
        });

        // Lấy toàn bộ sản phẩm liên quan để tránh query trong vòng lặp
        const products = await Product.find(
            { _id: { $in: [...productIds] } },
            { _id: 1, variations: 1 } // Chỉ lấy các field cần thiết
        );

        const productMap = new Map();
        products.forEach(product => {
            productMap.set(product._id.toString(), product.variations);
        });

        // Tính lợi nhuận theo tháng
        for (const order of orders) {
            const month = new Date(order.createdAt).getMonth(); // Lấy tháng (0 - 11)

            for (const item of order.items) {
                const variations = productMap.get(item.product_id.toString());
                if (!variations) continue;

                const variation = variations.find(v => v.category === item.category);
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

router.get("/profitOrders", async (req, res) => {
    try {
        const orders = await Order.aggregate([
            {
                $match: { status: statusOrder } // Chỉ lấy đơn hàng đã hoàn thành
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$totalPrice" } // Tính tổng doanh thu theo tháng
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 } // Sắp xếp theo tháng
            }
        ]);

        const formattedData = orders.map(order => ({
            month: `${order._id.year}-${order._id.month.toString().padStart(2, '0')}`,
            totalOrders: order.totalOrders,
            totalRevenue: order.totalRevenue
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
router.get("/revenue", async (req, res) => {
  try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // 1 = Jan, 12 = Dec

      // Lấy doanh thu của năm hiện tại
      const revenueData = await getMonthlyRevenue(currentYear);

      // Doanh thu tháng hiện tại
      const currentMonthData = revenueData.find((item) => item.month === currentMonth) || { revenue: 0 };
      const currentMonthRevenue = currentMonthData.revenue;

      // Doanh thu tháng trước
      let previousMonthRevenue = 0;
      let previousMonth = currentMonth - 1;
      let previousYear = currentYear;

      if (currentMonth === 1) {
          previousMonth = 12;
          previousYear = currentYear - 1;
          const lastYearRevenue = await getMonthlyRevenue(previousYear);
          previousMonthRevenue = lastYearRevenue.find((item) => item.month === previousMonth)?.revenue || 0;
      } else {
          previousMonthRevenue = revenueData.find((item) => item.month === previousMonth)?.revenue || 0;
      }

      // Tính phần trăm tăng trưởng so với tháng trước
      let growthRate = previousMonthRevenue > 0
          ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
          : 0;

      res.json({
          currentMonth: { month: currentMonth, year: currentYear, revenue: currentMonthRevenue },
          previousMonth: { month: previousMonth, year: previousYear, revenue: previousMonthRevenue },
          comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`, 
          growthRate: growthRate.toFixed(2) , 
          revenueByMonth: revenueData, 
      });
  } catch (error) {
      console.error("Lỗi khi lấy doanh thu:", error);
      res.status(500).json({ message: "Lỗi server!" });
  }
});

const getMonthlyProfit = async (year) => {
  const orders = await Order.find({ status: statusOrder });

  let monthlyProfit = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      year,
      profit: 0,
  }));

  for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      const month = orderDate.getMonth() + 1; // Lấy tháng
      const year = orderDate.getFullYear();

      for (const item of order.items) {
          const product = await Product.findOne(
              { 
                  _id: item.product_id, 
                  "variations.category": item.category,
                  "variations.theme": item.theme || { $exists: true } // Lọc đúng theme nếu có
              },
              { "variations.$": 1 } // Chỉ lấy biến thể khớp
          );

          if (!product) continue;

          const variation = product.variations[0];
          const costPrice = variation.costPrice || 0;
          const salePrice = variation.salePrice || 0;

          const profit = (salePrice - costPrice) * item.quantity;
          monthlyProfit[month - 1].profit += profit;
      }
  }

  return monthlyProfit;
};

// API lấy lợi nhuận tháng hiện tại và tháng trước
router.get("/profit", async (req, res) => {
  try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Lấy lợi nhuận theo tháng của năm hiện tại
      const profitData = await getMonthlyProfit(currentYear);

      // Lợi nhuận tháng hiện tại
      const currentMonthProfit = profitData.find((item) => item.month === currentMonth)?.profit || 0;

      // Lợi nhuận tháng trước
      let previousMonth = currentMonth - 1;
      let previousYear = currentYear;
      let previousMonthProfit = 0;

      if (currentMonth === 1) {
          previousMonth = 12;
          previousYear = currentYear - 1;
          const lastYearProfit = await getMonthlyProfit(previousYear);
          previousMonthProfit = lastYearProfit.find((item) => item.month === previousMonth)?.profit || 0;
      } else {
          previousMonthProfit = profitData.find((item) => item.month === previousMonth)?.profit || 0;
      }

      // Tính phần trăm tăng trưởng lợi nhuận so với tháng trước
      let growthRate = previousMonthProfit > 0
          ? ((currentMonthProfit - previousMonthProfit) / previousMonthProfit) * 100
          : 0;

      res.json({
          currentMonth: { month: currentMonth, year: currentYear, profit: currentMonthProfit },
          previousMonth: { month: previousMonth, year: previousYear, profit: previousMonthProfit },
          comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`, 
          growthRate: growthRate.toFixed(2),
          profitByMonth: profitData,
      });
  } catch (error) {
      console.error("Lỗi khi lấy lợi nhuận:", error);
      res.status(500).json({ message: "Lỗi server!" });
  }
});
const getMonthlyOrders = async (year) => {
    const orders = await Order.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(`${year}-01-01T00:00:00.000Z`),
                    $lte: new Date(`${year}-12-31T23:59:59.999Z`),
                },
                status: statusOrder, // Chỉ lấy đơn hàng đã hoàn thành
            },
        },
        {
            $group: {
                _id: { month: { $month: "$createdAt" } },
                totalOrders: { $sum: 1 }, // Đếm số đơn hàng
            },
        },
        { $sort: { "_id.month": 1 } },
    ]);

    // Mảng mặc định có đủ 12 tháng với số đơn hàng = 0
    const formattedOrders = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        year,
        totalOrders: 0,
    }));

    // Cập nhật số đơn hàng nếu có dữ liệu
    orders.forEach((item) => {
        formattedOrders[item._id.month - 1].totalOrders = item.totalOrders;
    });

    return formattedOrders;
};
router.get("/revenueByMonth", async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const orders = await Order.find({
            status: statusOrder, // Chỉ lấy đơn hàng đã hoàn thành
            createdAt: { 
                $gte: new Date(`${currentYear}-01-01`), 
                $lt: new Date(`${currentYear + 1}-01-01`) 
            }
        });

        // Khởi tạo doanh thu từng tháng (mặc định 0)
        let revenueByMonth = Array(12).fill(0).map((_, index) => ({
            month: index + 1,
            year: currentYear,
            revenue: 0
        }));

        // Tính tổng doanh thu theo tháng
        orders.forEach(order => {
            const month = new Date(order.createdAt).getMonth(); // Lấy tháng (0-11)
            revenueByMonth[month].revenue += order.totalPrice;
        });

        // Sắp xếp dữ liệu theo tháng
        revenueByMonth.sort((a, b) => a.month - b.month);

        // Tính toán doanh thu tháng hiện tại và tháng trước
        const currentMonthIndex = new Date().getMonth();
        const currentMonthRevenue = revenueByMonth[currentMonthIndex] || { revenue: 0 };
        const previousMonthRevenue = revenueByMonth[currentMonthIndex - 1] || { revenue: 0 };

        // Tính % tăng trưởng
        const growthRate = previousMonthRevenue.revenue 
            ? (((currentMonthRevenue.revenue - previousMonthRevenue.revenue) / previousMonthRevenue.revenue) * 100).toFixed(2) 
            : "0";

        // Chuẩn bị dữ liệu phản hồi
        const responseData = {
            currentMonth: currentMonthRevenue,
            previousMonth: previousMonthRevenue,
            comparisonText: `So với tháng ${previousMonthRevenue.month} năm ${previousMonthRevenue.year}`,
            growthRate,
            revenueByMonth
        };

        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error("Lỗi khi lấy doanh thu hàng tháng:", error);
        res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
    }
});

// API lấy số đơn hàng tháng hiện tại và tháng trước
router.get("/orderStats", async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; 

        // Lấy số đơn hàng theo tháng của năm hiện tại
        const orderData = await getMonthlyOrders(currentYear);

        // Số đơn hàng tháng hiện tại
        const currentMonthOrders = orderData.find((item) => item.month === currentMonth)?.totalOrders || 0;

        // Số đơn hàng tháng trước
        let previousMonth = currentMonth - 1;
        let previousYear = currentYear;
        let previousMonthOrders = 0;

        if (currentMonth === 1) {
            previousMonth = 12;
            previousYear = currentYear - 1;
            const lastYearOrders = await getMonthlyOrders(previousYear);
            previousMonthOrders = lastYearOrders.find((item) => item.month === previousMonth)?.totalOrders || 0;
        } else {
            previousMonthOrders = orderData.find((item) => item.month === previousMonth)?.totalOrders || 0;
        }

        // Tính phần trăm tăng trưởng số đơn hàng so với tháng trước
        let growthRate = previousMonthOrders > 0
            ? ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) * 100
            : 0;

        res.json({
            currentMonth: { month: currentMonth, year: currentYear, totalOrders: currentMonthOrders  },
            previousMonth: { month: previousMonth, year: previousYear, totalOrders: previousMonthOrders },
            comparisonText: `So với tháng ${previousMonth} năm ${previousYear}`,
            growthRate: growthRate.toFixed(2),
            ordersByMonth: orderData,
        });
    } catch (error) {
        console.error("Lỗi khi lấy số đơn hàng:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
});

router.get("/best-selling-products", async (req, res) => {
    try {
        const orders = await Order.find({ status: statusOrder });

        let productSales = {}; // Lưu trữ số lượng bán của từng sản phẩm

        for (const order of orders) {
            for (const item of order.items) {
                const key = `${item.product_id}_${item.category}_${item.theme || "no-theme"}`;

                if (!productSales[key]) {
                    productSales[key] = { product_id: item.product_id,avatar: item.avatar, category: item.category, theme: item.theme, soldCount: 0 };
                }

                productSales[key].soldCount += item.quantity;
            }
        }

        // Chuyển object thành mảng, sắp xếp theo số lượng bán giảm dần
        let sortedProducts = Object.values(productSales).sort((a, b) => b.soldCount - a.soldCount);

        // Lấy sản phẩm chi tiết từ DB
        let bestSellingProducts = await Promise.all(
            sortedProducts.map(async (prod) => {
                const product = await Product.findById(prod.product_id);
                return {
                    _id: product._id,
                    name: product.name,
                    category: prod.category,
                    theme: prod.theme !== "no-theme" ? prod.theme : null,
                    soldCount: prod.soldCount,
                    price: product.price,
                    avatar: product.avatar,
                };
            })
        );

        res.json({ success: true, bestSellingProducts });
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
router.get("/revenue-suggestions", async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // Tháng hiện tại
        const previousMonth = month === 1 ? 12 : month - 1;
        const previousYear = month === 1 ? year - 1 : year;

        // Lấy doanh thu tháng này và tháng trước
        const currentRevenue = await getRevenueByMonth(year, month);
        const lastMonthRevenue = await getRevenueByMonth(previousYear, previousMonth);

        // Lấy số lượng bán ra của từng sản phẩm
        const currentProductSales = await getProductSalesByMonth(year, month);
        const lastMonthProductSales = await getProductSalesByMonth(previousYear, previousMonth);

        let suggestions = [];

        // Nếu doanh thu giảm so với tháng trước
        if (currentRevenue < lastMonthRevenue) {
            suggestions.push("Doanh thu tháng này giảm so với tháng trước. Hãy đẩy mạnh quảng cáo và triển khai các chương trình khuyến mãi.");
        }

        // Phát hiện sản phẩm bán chậm hoặc giảm doanh số
        const products = await Product.find();
        products.forEach((product) => {
            const currentSales = currentProductSales[product._id] || 0;
            const lastMonthSales = lastMonthProductSales[product._id] || 0;
            console.log(`📊 ${product.name}: Tháng trước: ${lastMonthSales}, Tháng này: ${currentSales}`);

            if (lastMonthSales > 0 && (currentSales / lastMonthSales) <= 0.2) {
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
        res.status(500).json({ success: false, message: "Lỗi phân tích doanh thu" });
    }
});

router.get("/inventory", async (req, res) => {
    try {
        const products = await Product.find({}, "name variations");
        res.json({ success: true, inventory: products });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách hàng tồn kho:", error);
        res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách hàng tồn kho" });
    }
});
router.get("/inventory-report", async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category ? { category } : {};

        // Lấy danh sách sản phẩm
        const products = await Product.find(filter).select("name category variations avatar");

        // Lấy danh mục để ánh xạ _id → name
        const categories = await ProductCategory.find().select("_id name");
        const categoryMap = categories.reduce((acc, cat) => {
            acc[cat._id] = cat.name;
            return acc;
        }, {});

        const inventoryList = products.map(product => {
            const totalStock = product.variations.reduce((sum, variation) => sum + variation.stock, 0);
            
            return {
                productId: product._id,
                avatar: product.avatar,
                name: product.name,
                category: categoryMap[product.category] || "Không xác định", // Hiển thị tên danh mục
                totalStock,
                variations: product.variations.map(variation => ({
                    theme: variation.theme || "N/A",
                    category: variation.category || "N/A",
                    stock: variation.stock
                }))
            };
        });

        res.json({ 
            success: true, 
            totalProducts: inventoryList.length,
            inventory: inventoryList 
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách hàng tồn kho:", error);
        res.status(500).json({ success: false, message: "Lỗi server khi lấy hàng tồn kho" });
    }
});
router.get("/products-inventory/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Tìm sản phẩm theo ID
        const product = await Product.findById(id).select("name category variations avatar price brand");

        if (!product) {
            return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
        }

        // Lấy danh mục để ánh xạ _id → name
        const category = await ProductCategory.findById(product.category).select("name");

        // Tính tổng số lượng tồn kho từ tất cả biến thể
        const totalStock = product.variations.reduce((sum, variation) => sum + variation.stock, 0);

        // Chuẩn bị dữ liệu trả về
        const productDetail = {
            productId: product._id,
            avatar: product.avatar,
            name: product.name,
            category: category ? category.name : "Không xác định",
            price: product.price,
            brand: product.brand,
            totalStock,
            variations: product.variations.map(variation => ({
                theme: variation.theme || "N/A",
                category: variation.category || "N/A",
                stock: variation.stock
            }))
        };

        res.json({ success: true, product: productDetail });
    } catch (error) {
        console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
        res.status(500).json({ success: false, message: "Lỗi server khi lấy sản phẩm" });
    }
});

router.put("/update-stock/:productId", async (req, res) => {
    try {
        const { productId } = req.params;
        const { variations } = req.body;
        
        if (!variations || !Array.isArray(variations) || variations.length === 0) {
            return res.status(400).json({ message: "Dữ liệu variations không hợp lệ!" });
        }


        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
        }


        product.variations.forEach((variation) => {
            const updatedVariation = variations.find(
                (v) => v.category === variation.category && v.theme === variation.theme
            );

            if (updatedVariation) {
                console.log(`Cập nhật stock cho ${variation.category} - ${variation.theme}`);
                variation.stock += Number(updatedVariation.additionalStock || 0);
            }
        });

        // Lưu cập nhật vào database
        await product.save();
        console.log("Cập nhật thành công:", product.variations);

        res.json({ message: "Cập nhật stock thành công", product });
    } catch (error) {
        console.error("Lỗi cập nhật stock:", error);
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

const predictStockNeeded = (salesHistory, currentStock) => {
    if (!Array.isArray(salesHistory) || salesHistory.length === 0) return 0;

    const avgSalesPerDay = salesHistory.reduce((a, b) => a + b, 0) / salesHistory.length;
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
router.get("/predict-stock", async (req, res) => {
    try {
        const products = await Product.find().lean();
        let stockPredictions = [];

        for (let product of products) {
            for (let variation of product.variations) {
                // Lấy danh sách đơn hàng chứa biến thể này
                const orders = await Order.find({ "items.product_id": product._id }).lean();

                // Lọc đơn hàng trong 30 ngày gần nhất
                const salesHistory = {};
                const today = new Date();
                const past30Days = new Date(today);
                past30Days.setDate(today.getDate() - 30);

                orders.forEach(order => {
                    const orderDate = new Date(order.createdAt);
                    if (orderDate >= past30Days) {
                        order.items.forEach(item => {
                            if (item.product_id.toString() === product._id.toString() && 
                                item.category === variation.category &&
                                item.theme === variation.theme) {
                                const dateKey = orderDate.toISOString().split("T")[0]; // YYYY-MM-DD
                                salesHistory[dateKey] = (salesHistory[dateKey] || 0) + item.quantity;
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

module.exports = router;
