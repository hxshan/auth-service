// auth-service/src/utils/validation.js
const Joi = require("joi");

// Validate signup data
const validateSignup = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().label("Email"),
    password: Joi.string().min(6).required().label("Password"),
    // Make roles optional in request body
    roles: Joi.array().items(
      Joi.string().valid("customer", "restaurant", "driver")
    ).min(1).optional().label("Roles"),
    // Allow other fields without validation
    name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional()
  }).unknown(true); // Allow unknown keys

  return schema.validate(data);
};

// Validate login data
const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().label("Email"),
    password: Joi.string().required().label("Password"),
  });

  return schema.validate(data);
};

// Validate OTP data
const validateOTP = (data) => {
  const schema = Joi.object({
    userId: Joi.string().required().label("User ID"),
    otp: Joi.string().required().label("OTP"),
  });

  return schema.validate(data);
};

// Validate Resend OTP data
const validateResendOTP = (data) => {
  const schema = Joi.object({
    userId: Joi.string().required().label("User ID"),
  });

  return schema.validate(data);
};

// Validate Add Role data
const validateAddRole = (data) => {
  const schema = Joi.object({
    userId: Joi.string().required().label("User ID"),
    email: Joi.string().email().required().label("Email"),
    password: Joi.string().required().label("Password"),
  });

  return schema.validate(data);
};

module.exports = { 
  validateSignup, 
  validateLogin, 
  validateOTP,
  validateResendOTP,
  validateAddRole
};