// auth-service/src/controllers/baseAuthController.js
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { User } = require("../models/user");
const { UserOTPVerification } = require("../models/userOTPVerification");
const { 
  validateSignup, 
  validateLogin, 
  validateOTP, 
  validateResendOTP 
} = require("../utils/validation");
const { sendOTPVerificationEmail } = require("../services/emailService");
require("dotenv").config();

class BaseAuthController {
  constructor(userRole) {
    this.userRole = userRole;
  }

  // Register user
  signup = async (req, res) => {
    try {
      // Get request data
      const userData = req.body;

      // Validate basic user data
      const { error } = validateSignup(userData);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      // Check if user already exists
      const userFound = await User.findOne({ email: userData.email });
      
      // If user exists but not verified, allow re-registration
      if (userFound && userFound.verified) {
        return res.status(409).json({ message: "User already exists and is verified" });
      } else if (userFound && !userFound.verified) {
        // Delete unverified user to allow re-registration
        await User.deleteOne({ email: userData.email });
      }

      // Hash password
      const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
      const hashPassword = await bcrypt.hash(userData.password, salt);

      // Determine roles
      let roles = [this.userRole]; // Always use the controller's role
      
      // If additional roles are provided in the body and they're valid, add them
      if (userData.roles && Array.isArray(userData.roles)) {
        userData.roles.forEach(role => {
          if (["customer", "restaurant", "driver"].includes(role) && !roles.includes(role)) {
            roles.push(role);
          }
        });
      }

      // Create new user with the role determined by the controller
      const newUser = new User({
        userId: uuidv4(),
        email: userData.email,
        password: hashPassword,
        roles: roles,
        verified: false,
      });

      await newUser.save();

      // Send verification email
      await sendOTPVerificationEmail(newUser);

      return res.status(201).json({
        message: `User registered successfully as ${this.userRole}. OTP sent to email for verification.`,
        userId: newUser.userId,
      });
    } catch (error) {
      console.error(`Error in ${this.userRole} registration:`, error.message);
      if (error.message === "Failed to send OTP email") {
        return res.status(500).json({ 
          error: "Failed to send verification email. Please try again later." 
        });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // Login user
  login = async (req, res) => {
    try {
      const { error } = validateLogin(req.body);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      const userFound = await User.findOne({ email: req.body.email });
      if (!userFound) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user has the specific role based on the controller
      const roles = userFound.roles || [];
      if (!Array.isArray(roles) || !roles.includes(this.userRole)) {
        return res.status(403).json({ 
          message: `Access denied. You are not registered as a ${this.userRole}` 
        });
      }

      // Check if user is verified
      if (!userFound.verified) {
        return res.status(403).json({ 
          message: "Email not verified. Please verify your email before logging in",
          userId: userFound.userId,
          status: "UNVERIFIED"
        });
      }

      const validPassword = await bcrypt.compare(
        req.body.password,
        userFound.password
      );
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = userFound.generateAuthToken();
      
      res.status(200).json({
        userId: userFound.userId,
        email: userFound.email,
        roles: userFound.roles,
        profileCompleted: userFound.profileCompleted,
        currentRole: this.userRole, // Include the role they're logged in as
        token: token,
      });
    } catch (error) {
      console.error(`Error in ${this.userRole} login:`, error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // Verify OTP - this is shared across all user types
  verifyOTP = async (req, res) => {
    try {
      const { error } = validateOTP(req.body);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      const { userId, otp } = req.body;
      const userOTPRecord = await UserOTPVerification.findOne({ userId });

      if (!userOTPRecord) {
        return res.status(400).json({
          message: "No OTP record found or it may have expired",
          status: "EXPIRED"
        });
      }

      const { expiresAt, otp: hashedOTP } = userOTPRecord;

      if (Date.now() > expiresAt) {
        await UserOTPVerification.deleteMany({ userId });
        return res.status(400).json({ 
          message: "OTP has expired. Please request a new one",
          status: "EXPIRED"
        });
      }

      const isMatch = await bcrypt.compare(otp, hashedOTP);
      if (!isMatch) {
        return res.status(400).json({ 
          message: "Invalid OTP",
          status: "INVALID" 
        });
      }

      // Find the user to get their roles
      const user = await User.findOne({ userId });
      if (!user) {
        return res.status(404).json({ 
          message: "User not found",
          status: "ERROR"
        });
      }

      // OTP is valid — update user as verified
      await User.updateOne({ userId }, { verified: true });

      // Delete the OTP record after successful verification
      await UserOTPVerification.deleteMany({ userId });

      return res.status(200).json({ 
        message: "Email verified successfully",
        status: "SUCCESS",
        roles: user.roles
      });
    } catch (error) {
      console.error("Error verifying OTP:", error.message);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // Resend OTP
  resendOTP = async (req, res) => {
    try {
      const { error } = validateResendOTP(req.body);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      const { userId, email } = req.body;
      
      // Find the user
      const user = await User.findOne({ userId, email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already verified
      if (user.verified) {
        return res.status(400).json({ 
          message: "Email already verified. Please login" 
        });
      }

      // Delete previous OTPs
      await UserOTPVerification.deleteMany({ userId });

      // Re-send new OTP
      await sendOTPVerificationEmail(user);

      return res.status(200).json({ 
        message: "OTP resent successfully",
        email: user.email // Return email for confirmation
      });
    } catch (error) {
      console.error("Error resending OTP:", error.message);
      return res.status(500).json({ message: "Error resending OTP" });
    }
  };
}

module.exports = BaseAuthController;