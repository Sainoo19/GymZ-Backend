require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
var logger = require('morgan');
const cors = require('cors');
//khai bao ket noi db
const database = require('./config/ConnectDB');
//khai bao router
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/admin/users');
var employeesRouter = require('./routes/admin/employees');
var branchesRouter = require('./routes/admin/branches');
var productRouter = require('./routes/admin/products');
var exercisesRouter = require('./routes/admin/exercises');
var workoutsRouter = require('./routes/admin/workouts');
var ordersRouter = require('./routes/admin/orders');
var paymentsRouter = require('./routes/admin/payments');
var productCategoryRouter = require('./routes/admin/productCategory');
var reviewsRouter = require('./routes/admin/reviews');
var discountsRouter = require('./routes/admin/discounts');
var authRouter = require('./routes/auth');
var productClientRouter = require('./routes/clients/productClients')
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Cấu hình CORS
app.use(cors({
  origin: 'http://localhost:3001', // Chỉ định nguồn gốc cụ thể
  methods: 'GET, POST, PUT, DELETE',
  allowedHeaders: 'Content-Type, Authorization, cache-control', // Thêm cache-control vào danh sách các header được phép
  credentials: true // Cho phép gửi cookie
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/employees', employeesRouter);
app.use('/branches', branchesRouter);
app.use('/products', productRouter);
app.use('/exercises', exercisesRouter);
app.use('/workouts', workoutsRouter);
app.use('/orders', ordersRouter);
app.use('/payments', paymentsRouter);
app.use('/productCategory', productCategoryRouter);
app.use('/discounts', discountsRouter);
app.use('/reviews', reviewsRouter);
app.use('/auth', authRouter);
app.use('/productClient', productClientRouter);
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