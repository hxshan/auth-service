const express = require("express");
const router = express.Router();
const { DriverAuthController } = require("../controllers/driverAuthController");
const driverAuthController = new DriverAuthController();

// Driver auth routes
router.post("/signup", driverAuthController.signup);
router.post("/login", driverAuthController.login);
router.post("/verify-otp", driverAuthController.verifyOTP);
router.post("/resend-otp", driverAuthController.resendOTP);

module.exports = router;