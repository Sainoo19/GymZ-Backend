const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Cart = require("../../models/cart");
const Product = require("../../models/products");
const Order = require("../../models/orders");
const { authenticate } = require("../../middlewares/auth");

// Thêm sản phẩm vào giỏ hàng
router.post("/add", authenticate, async (req, res) => {
    try {
        const { product_id, quantity, theme, category } = req.body;
        const userId = req.user.id;

        // Kiểm tra đầu vào hợp lệ
        if (!product_id || !quantity || isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: "Dữ liệu đầu vào không hợp lệ" });
        }

        // Tìm sản phẩm theo ID
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        // Lọc biến thể phù hợp với category và theme
        const variation = product.variations.find(v => v.category === category && v.theme === theme);

        if (!variation) {
            return res.status(404).json({ message: "Không tìm thấy biến thể sản phẩm phù hợp" });
        }

        if (!variation.salePrice || isNaN(variation.salePrice)) {
            return res.status(400).json({ message: "Giá sản phẩm không hợp lệ" });
        }

        // Kiểm tra số lượng tồn kho
        if (variation.stock < quantity) {
            return res.status(400).json({ message: "Số lượng sản phẩm không đủ" });
        }

        // Tìm giỏ hàng của người dùng
        let cart = await Cart.findOne({ user_id: userId });
        if (!cart) {
            cart = new Cart({
                _id: new mongoose.Types.ObjectId().toString(),
                user_id: userId,
                totalPrice: 0,
                items: [],
            });
        }

        // Kiểm tra sản phẩm đã có trong giỏ chưa
        const existingItem = cart.items.find(item => 
            item.product_id === product_id && item.category === category && item.theme === theme
        );

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                product_id,
                quantity,
                theme,
                category,
                price: variation.salePrice, // Lấy giá từ biến thể
            });
        }

        // Tính tổng giá
        cart.totalPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cart.updatedAt = Date.now();

        await cart.save();
        res.status(200).json({ message: "Đã thêm vào giỏ hàng", cart });
    } catch (error) {
        console.error("Lỗi khi thêm vào giỏ hàng:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});


// Lấy toàn bộ sản phẩm trong giỏ hàng
router.get("/get", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ user_id: userId });

        if (!cart || cart.items.length === 0) {
            return res.status(200).json({ message: "Giỏ hàng trống", cart: { items: [] } });
        }

        // Lấy thông tin sản phẩm từ Product collection
        const populatedItems = await Promise.all(
            cart.items.map(async (item) => {
                const product = await Product.findById(item.product_id).select("name avatar");
                return {
                    ...item.toObject(),
                    productName: product?.name || "Không có tên",
                    productAvatar: product?.avatar || "",
                };
            })
        );

        res.status(200).json({ message: "Lấy giỏ hàng thành công", cart: { ...cart.toObject(), items: populatedItems } });
    } catch (error) {
        console.error("Lỗi khi lấy giỏ hàng:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});

router.delete("/remove", authenticate, async (req, res) => {
    try {
      const { product_id, category, theme } = req.body;
      const user_id = req.user.id; // Lấy ID user từ token/session
  
      if (!product_id || !category) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin sản phẩm cần xoá" });
      }
  
      // Tạo điều kiện tìm sản phẩm
      let condition = { product_id, category };
      if (theme) condition.theme = theme;
  
      // Xoá sản phẩm
      const updatedCart = await Cart.findOneAndUpdate(
        { user_id },
        { $pull: { items: condition } },
        { new: true }
      );
  
      if (!updatedCart) {
        return res.status(404).json({ success: false, message: "Không tìm thấy giỏ hàng" });
      }
  
      // Cập nhật lại totalPrice
      updatedCart.totalPrice = updatedCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      await updatedCart.save();
  
      res.json({ success: true, cart: updatedCart });
    } catch (error) {
      console.error("Lỗi khi xoá sản phẩm:", error);
      res.status(500).json({ success: false, message: "Lỗi khi xoá sản phẩm" });
    }
  });
  

  
  
  // API cập nhật số lượng sản phẩm trong giỏ hàng
  router.put("/updateQuantity", authenticate,async (req, res) => {
    try {
        console.log("Request Body:", req.body);

        const { product_id, theme, category, quantity } = req.body;
        const user_id = req.user?.id; // Đảm bảo user_id có giá trị

        if (!product_id || !category || !quantity || quantity < 1) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ!", data: req.body });
        }

        const cart = await Cart.findOne({ user_id });
        if (!cart) return res.status(404).json({ message: "Giỏ hàng không tồn tại!" });

        const item = cart.items.find(
            (i) => i.product_id === product_id && i.category === category && (!theme || i.theme === theme)
        );

        if (!item) return res.status(404).json({ message: "Sản phẩm không tồn tại trong giỏ hàng!" });

        item.quantity = quantity;
        cart.totalPrice = cart.items.reduce((total, i) => total + i.price * i.quantity, 0);

        await cart.save();
        return res.status(200).json({ cart });
    } catch (error) {
        console.error("Lỗi khi cập nhật số lượng:", error);
        return res.status(500).json({ message: "Lỗi server", error });
    }
});

  
router.delete("/clear", authenticate, async (req, res) => {
    try {
        const { orderId } = req.body;
        const user_id = req.user.id;

        if (!orderId) {
            return res.status(400).json({ message: "Thiếu orderId" });
        }

        // Tìm đơn hàng trong database
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        // Tìm giỏ hàng của người dùng
        const cart = await Cart.findOne({ user_id });
        if (!cart) {
            return res.status(404).json({ message: "Giỏ hàng không tồn tại" });
        }

        // Lọc bỏ sản phẩm theo category và theme
        cart.items = cart.items.filter(cartItem => 
            !order.items.some(orderItem =>
                orderItem.category === cartItem.category &&
                (orderItem.theme ? orderItem.theme === cartItem.theme : true) // Kiểm tra nếu có theme thì phải trùng
            )
        );

        // Cập nhật lại totalPrice
        cart.totalPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        await cart.save();

        res.status(200).json({ message: "Đã xoá sản phẩm theo category và theme khỏi giỏ hàng", cart });
    } catch (error) {
        console.error("Lỗi khi xoá sản phẩm theo category và theme:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});

  
module.exports = router;
