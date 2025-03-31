const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/users");
const Employee = require("../models/employees");
const generateId = require("../utils/generateId");
const customResponse = require("../utils/customResponse");
const router = express.Router();
const passport = require("./API_Third_Party/config/passport");
const { OAuth2Client } = require("google-auth-library");

// Sử dụng middleware customResponse
router.use(customResponse);

// Hàm tạo access token cho User
const generateUserAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// Hàm tạo refresh token cho User
const generateUserRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

// Hàm tạo access token cho Employee
const generateEmployeeAccessToken = (employee) => {
  return jwt.sign(
    { id: employee._id, role: employee.role, branch_id: employee.branch_id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

// Hàm tạo refresh token cho Employee
const generateEmployeeRefreshToken = (employee) => {
  return jwt.sign(
    { id: employee._id, role: employee.role, branch_id: employee.branch_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google/token", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ status: "error", message: "Thiếu token" });
  }

  try {
    // Xác minh token từ Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    console.log("Google Token Payload:", payload);

    // Kiểm tra user đã tồn tại hay chưa
    let user = await User.findOne({ email });

    if (!user) {
      // Nếu chưa tồn tại, tạo user mới
      const newUserId = await generateId("US");

      user = new User({
        _id: newUserId,
        email,
        name: payload.name || "Người dùng mới",
        phone: "",
        role: "user",
        status: "active",
        avatar: payload.picture || "",
        createdAt: new Date(),
        updatedAt: new Date(),
        address: {
          province: "",
          district: "",
          ward: "",
          street: "",
        },
      });

      try {
        await user.save();
        console.log("✅ User saved successfully:", user);
      } catch (err) {
        console.error("❌ Error saving user:", err.message);
        return res.status(500).json({
          status: "error",
          message: "Lỗi lưu user vào database",
          error: err.message,
        });
      }
    }

    // Nếu user đã tồn tại, chỉ cần đăng nhập bằng Google
    console.log("✅ User exists, proceeding with login:", user);

    // Tạo access token và refresh token
    const accessToken = generateUserAccessToken(user);
    const refreshToken = generateUserRefreshToken(user);
    console.log("accessToken", accessToken);
    // Lưu token vào cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    res.successResponse({ accessToken, user }, "User logged in successfully");
  } catch (error) {
    console.error("Lỗi xác minh Google token:", error);
    res.status(401).json({ status: "error", message: "Token không hợp lệ" });
  }
});

router.post("/login/user", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.errorResponse("Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.errorResponse("Invalid email or password", 401);
    }

    const accessToken = generateUserAccessToken(user);
    const refreshToken = generateUserRefreshToken(user);

    // Set refresh token as a cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    res.successResponse({ accessToken, user }, "User logged in successfully");
  } catch (error) {
    console.error("Error logging in user:", error);
    res.errorResponse("Server error", 500, { error });
  }
});

// router.get(
//   "/google",
//   passport.authenticate("google", { scope: ["profile", "email"] })
// );
// // Route callback Google sau khi xác thực thành công
// router.get(
//   "/google/callback",
//   passport.authenticate("google", { failureRedirect: "/login-user" }),
//   (req, res) => {
//     // Sau khi đăng nhập thành công, tạo JWT và lưu vào cookie
//     const user = req.user;
//     const accessToken = generateUserAccessToken(user);
//     const refreshToken = generateUserRefreshToken(user);
//     res.cookie("accessToken", accessToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//     });
//     res.cookie("refreshToken", refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//     });
//     // Redirect về frontend (ví dụ: trang chủ)
//   }
// );

router.post("/register/user", async (req, res) => {
  try {
    const { email, password, phone, name, address } = req.body;

    // Kiểm tra đầu vào
    if (!email || !password || !phone || !name || !address) {
      return res
        .status(400)
        .json({ status: "error", message: "Vui lòng điền đầy đủ thông tin" });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: "error", message: "Email đã tồn tại" });
    }

    // Băm mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo ID mới
    const newUserId = await generateId("US");

    // Tạo người dùng mới
    const newUser = new User({
      _id: newUserId,
      email,
      password: hashedPassword,
      phone,
      name,
      role: "user",
      status: "active",
      avatar: "",
      address: {
        province: address.city || "",
        district: address.district || "",
        ward: address.ward || "",
        street: address.street || "",
      },
    });

    await newUser.save();

    return res
      .status(201)
      .json({ status: "success", message: "Đăng ký thành công" });
  } catch (error) {
    console.error("Lỗi đăng ký người dùng:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Lỗi server", error: error.message });
  }
});

router.post("/login/employee", async (req, res) => {
  const { email, password } = req.body;

  try {
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.errorResponse("Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.errorResponse("Invalid email or password", 401);
    }

    const accessToken = generateEmployeeAccessToken(employee);
    const refreshToken = generateEmployeeRefreshToken(employee);

    // Set refresh token as a cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    res.successResponse(
      { accessToken, employee },
      "Employee logged in successfully"
    );
  } catch (error) {
    console.error("Error logging in employee:", error);
    res.errorResponse("Server error", 500, { error });
  }
});

router.post("/refresh-token", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res
      .status(401)
      .json({ message: "No refresh token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = {
      id: decoded.id,
      role: decoded.role,
      branch_id: decoded.branch_id,
    };
    const accessToken = user.branch_id
      ? generateEmployeeAccessToken(user)
      : generateUserAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});
router.post("/logout", (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
});
module.exports = router;
