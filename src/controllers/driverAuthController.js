const BaseAuthController = require('./baseAuthController');

class DriverAuthController extends BaseAuthController {
  constructor() {
    super('driver');
  }
  
  // Add driver-specific authentication methods if needed
}

module.exports = { 
    
    DriverAuthController, 
    
  };