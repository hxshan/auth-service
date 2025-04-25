// auth-service/src/controllers/baseAuthController.js
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { User } = require("../models/user");
const { UserOTPVerification } = require("../models/userOTPVerification");
const { 
  validateSignup, 
  validateLogin, 
  validateOTP, 
  validateResendOTP,
  validateAddRole
} = require("../utils/validation");
const { sendOTPVerificationEmail } = require("../services/emailService");
require("dotenv").config();

class BaseAuthController {
  constructor(userRole) {
    this.userRole = userRole;
  }

  // Register user
  signup = async (req, res) => {
    console.log('Auth Service received signup:', req.body);
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
      
      if (userFound) {
        // If user exists but is inactive (unverified), resend OTP
        if (userFound.status === "inactive") {
          // Send verification email again
          await sendOTPVerificationEmail(userFound);
          
          return res.status(200).json({
            message: "Verification code has been resent to your email.",
            userId: userFound.userId,
          });
        }
        // If this is an existing active or pending user trying to add a new role
        else if (userFound.status === "active" || userFound.status === "pending") {
          // Check if they already have this role
          if (userFound.roles.includes(this.userRole)) {
            return res.status(409).json({ 
              message: `You already have registered as ${this.userRole} ` 
            });
          }
          
          // Password validation for existing user
          const validPassword = await bcrypt.compare(
            userData.password,
            userFound.password
          );
          if (!validPassword) {
            return res.status(401).json({ message: "Invalid password for existing account" });
          }
          
          // Add the new role to existing roles array (not replacing)
          const updatedRoles = [...userFound.roles, this.userRole];
          
          // Create a plain object for roleStatus update
          const roleStatusUpdate = {};
          roleStatusUpdate[this.userRole] = this.userRole === "customer" ? "active" : "pending";
          
          // Add the new role and update roleStatus
          await User.updateOne(
            { _id: userFound._id },
            { 
              roles: updatedRoles,
              $set: { [`roleStatus.${this.userRole}`]: roleStatusUpdate[this.userRole] }
            }
          );
          
          // Get updated user for response
          const updatedUser = await User.findById(userFound._id);
          
          return res.status(200).json({
            message: `${this.userRole} role added to your account`,
            userId: updatedUser.userId,
            roles: updatedUser.roles,
            roleStatus: updatedUser.roleStatus
          });
        } else {
          // User is suspended or banned
          return res.status(403).json({ 
            message: "This account cannot be modified at this time",
            status: userFound.status
          });
        }
      }
  
      // Hash password for new user
      const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
      const hashPassword = await bcrypt.hash(userData.password, salt);
  
      // Set the initial role based on the controller
      let roles = [this.userRole];
      
      // Create role-specific status tracking
      const roleStatus = {};
      roleStatus[this.userRole] = "inactive"; // Initially inactive until OTP verification
      
      // Create new user
      const newUser = new User({
        userId: uuidv4(),
        email: userData.email,
        password: hashPassword,
        roles: roles,
        roleStatus: roleStatus,
        status: "inactive", // Overall account status starts as inactive
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

      // Get role-specific status
      const roleStatus = userFound.roleStatus || {};
      const currentRoleStatus = roleStatus[this.userRole] || userFound.status;

      // Check overall account status first
      if (userFound.status === "suspended") {
        return res.status(403).json({ 
          message: "Your account has been suspended. Please contact support.",
          status: "SUSPENDED"
        });
      } else if (userFound.status === "banned") {
        return res.status(403).json({ 
          message: "Your account has been banned.",
          status: "BANNED"
        });
      }

      // Then check role-specific status
      if (currentRoleStatus === "inactive") {
        return res.status(403).json({ 
          message: "Email not verified. Please verify your email before logging in",
          userId: userFound.userId,
          status: "UNVERIFIED"
        });
      } else if (currentRoleStatus === "pending" && this.userRole !== "customer") {
        return res.status(403).json({ 
          message: `Your ${this.userRole} account is pending approval. We'll notify you once approved.`,
          status: "PENDING"
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
        status: userFound.status,
        roleStatus: userFound.roleStatus,
        profileCompleted: userFound.profileCompleted,
        currentRole: this.userRole, // Include the role they're logged in as
        token: token,
      });
    } catch (error) {
      console.error(`Error in ${this.userRole} login:`, error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // Verify OTP - updated to handle multiple roles and return a JWT token
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

    // Find the user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ 
        message: "User not found",
        status: "ERROR"
      });
    }

    // Update roleStatus for each role
    const updateOps = {};
    let hasActive = false;
    let hasPending = false;
    
    // Prepare the MongoDB update operations
    user.roles.forEach(role => {
      const roleStatus = role === "customer" ? "active" : "pending";
      updateOps[`roleStatus.${role}`] = roleStatus;
      
      if (roleStatus === "active") hasActive = true;
      if (roleStatus === "pending") hasPending = true;
    });
    
    // Set overall account status based on role statuses
    let overallStatus = "inactive";
    if (hasActive) {
      overallStatus = "active";
    } else if (hasPending) {
      overallStatus = "pending";
    }

    // Update user with new status values
    await User.updateOne(
      { userId }, 
      { 
        status: overallStatus,
        $set: updateOps
      }
    );

    // Get updated user for response
    const updatedUser = await User.findOne({ userId });

    // Delete the OTP record after successful verification
    await UserOTPVerification.deleteMany({ userId });

    // Generate JWT token for the user
    const token = updatedUser.generateAuthToken();

    return res.status(200).json({ 
      message: "Email verified successfully",
      status: "SUCCESS",
      accountStatus: overallStatus,
      roleStatus: updatedUser.roleStatus,
      roles: updatedUser.roles,
      userId: updatedUser.userId,
      email: updatedUser.email,
      profileCompleted: updatedUser.profileCompleted,
      currentRole: this.userRole, // Include the role they're logged in as
      token: token // Add JWT token to response
    });
  } catch (error) {
    console.error("Error verifying OTP:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

  // Add a new role to an existing user
  addRole = async (req, res) => {
    try {
      const { error } = validateAddRole(req.body);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      const { userId, email, password } = req.body;
      
      // Find the user
      const user = await User.findOne({ userId, email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // Check if user already has this role
      if (user.roles.includes(this.userRole)) {
        return res.status(409).json({ 
          message: `You already have the ${this.userRole} role` 
        });
      }

      // Check if account is active
      if (user.status === "suspended" || user.status === "banned") {
        return res.status(403).json({ 
          message: "This account cannot be modified at this time",
          status: user.status
        });
      }

      // Construct updated roles array (not replacing)
      const updatedRoles = [...user.roles, this.userRole];
      
      // Update the roleStatus for the new role
      const roleStatus = this.userRole === "customer" ? "active" : "pending";

      await User.updateOne(
        { _id: user._id },
        { 
          roles: updatedRoles,
          $set: { [`roleStatus.${this.userRole}`]: roleStatus }
        }
      );

      // Get updated user for response
      const updatedUser = await User.findById(user._id);

      return res.status(200).json({
        message: `${this.userRole} role added to your account`,
        userId: updatedUser.userId,
        roles: updatedUser.roles,
        roleStatus: updatedUser.roleStatus
      });
    } catch (error) {
      console.error(`Error adding ${this.userRole} role:`, error.message);
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

      const { userId } = req.body;
      
      // Find the user
      const user = await User.findOne({ userId });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already verified (active or pending)
      if (user.status === "active" || user.status === "pending") {
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