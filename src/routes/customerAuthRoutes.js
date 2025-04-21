const express = require("express");
const router = express.Router();
const { CustomerAuthController } = require("../controllers/customerAuthController");
const customerAuthController = new CustomerAuthController();

// Customer auth routes
router.post("/signup", customerAuthController.signup);
router.post("/login", customerAuthController.login);
router.post("/verify-otp", customerAuthController.verifyOTP);
router.post("/resend-otp", customerAuthController.resendOTP);

module.exports = router;