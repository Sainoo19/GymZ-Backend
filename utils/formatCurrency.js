const formatCurrency = (value) => {
  if (typeof value !== "string") {
    value = String(value);
  }
  let number = value.replace(/\D/g, "");
  return number.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

module.exports = formatCurrency;
