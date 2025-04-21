const express = require("express");
const router = express.Router();
const { RestaurantAuthController } = require("../controllers/restaurantAuthController");
const restaurantAuthController = new RestaurantAuthController();

// Restaurant auth routes
router.post("/signup", restaurantAuthController.signup);
router.post("/login", restaurantAuthController.login);
router.post("/verify-otp", restaurantAuthController.verifyOTP);
router.post("/resend-otp", restaurantAuthController.resendOTP);

module.exports = router;