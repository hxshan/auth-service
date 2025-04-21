const BaseAuthController = require("./baseAuthController");

class CustomerAuthController extends BaseAuthController {
  constructor() {
    super("customer");
  }

  // Add customer-specific authentication methods if needed
}

module.exports = {
  CustomerAuthController,
};
