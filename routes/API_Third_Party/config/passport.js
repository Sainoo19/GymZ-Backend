const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../../../models/users"); // Sử dụng model User

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Kiểm tra xem user đã tồn tại chưa
      let user = await User.findOne({ email: profile.emails[0].value });

      if (!user) {
        // Nếu chưa, tạo user mới (không cần mật khẩu vì đăng nhập bằng Google)
        const newUser = new User({
          _id: profile.id, // Sử dụng Google ID làm _id
          email: profile.emails[0].value,
          name: profile.displayName,
          phone: "", // Nếu không có, để rỗng
          role: "user",
          status: "active",
          avatar: profile.photos[0].value,
          address: {
            province: "",
            district: "",
            ward: "",
            street: "",
          },
        });

        user = await newUser.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
