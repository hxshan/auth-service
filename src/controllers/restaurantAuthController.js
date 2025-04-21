const BaseAuthController = require('./baseAuthController');

class RestaurantAuthController extends BaseAuthController {
  constructor() {
    super('restaurant');
  }
  
  // Add restaurant-specific authentication methods if needed
}

module.exports = { 
    RestaurantAuthController 
  };