require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
var logger = require('morgan');
const cors = require('cors');
const passport = require("./routes/API_Third_Party/config/passport");

const URL_FRONTEND = process.env.URL_FRONTEND;
//khai bao ket noi db
const database = require('./config/ConnectDB');

//khai bao router
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/admin/users');
var employeesRouter = require('./routes/admin/employees');
var branchesRouter = require('./routes/admin/branches');
var productRouter = require('./routes/admin/products');
var ordersRouter = require('./routes/admin/orders');
var paymentsRouter = require('./routes/admin/payments');
var productCategoryRouter = require('./routes/admin/productCategory');
var reviewsRouter = require('./routes/admin/reviews');
var discountsRouter = require('./routes/admin/discounts');
var authRouter = require('./routes/auth');
var productClientRouter = require('./routes/clients/productClients')
var cartClientRouter = require('./routes/clients/cartClient')
var paymentRoutes = require('./routes/API_Third_Party/payment/MomoPayment')
var userClientRoutes = require('./routes/clients/userClient')
var orderClientRoutes = require('./routes/clients/orderClient')
var GHTKShippingRoutes = require('./routes/API_Third_Party/Shipping/GHTK')
var paymentClientRoutes = require('./routes/clients/paymentClient')
var analysisAdminRoutes = require('./routes/admin/analysis')
var profileUsersRouter = require('./routes/clients/profileUser')
var memberRouter = require('./routes/admin/members')
var memberBillRouter = require('./routes/admin/memberBill')
var trainingSessionRouter = require('./routes/admin/trainningSession')
var membershipRouter = require('./routes/clients/memberClient')
var branchesClientRouter = require('./routes/clients/branchesClients')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());

// Define allowed origins explicitly
const allowedOrigins = [
  'http://localhost:3000',
  'https://gym-z-frontend.vercel.app',
  // Add your actual frontend domain here
];

// Cấu hình CORS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization, cache-control, X-Requested-With',
  exposedHeaders: ['set-cookie'],
  credentials: true
}));

app.use('/home', indexRouter);
app.use('/users', usersRouter);
app.use('/employees', employeesRouter);
app.use('/branches', branchesRouter);
app.use('/products', productRouter);
app.use('/orders', ordersRouter);
app.use('/payments', paymentsRouter);
app.use('/productCategory', productCategoryRouter);
app.use('/discounts', discountsRouter);
app.use('/reviews', reviewsRouter);
app.use('/auth', authRouter);
app.use('/productClient', productClientRouter);
app.use('/cartClient', cartClientRouter);
app.use('/payment', paymentRoutes);
app.use("/userClient", userClientRoutes);
app.use("/orderClient", orderClientRoutes);
app.use("/shipping", GHTKShippingRoutes);
app.use("/paymentClient", paymentClientRoutes);
app.use("/analysis", analysisAdminRoutes);
app.use('/profileUser', profileUsersRouter);
app.use("/members", memberRouter);
app.use("/membersBill", memberBillRouter);
app.use('/trainingSession', trainingSessionRouter);
app.use('/membership', membershipRouter);
app.use('/branchesClient', branchesClientRouter);
database.connect();


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;