const express = require("express");
const router = express.Router();
const  UsersController  = require("../controllers/UsersController");
const usersController = new UsersController();

// user routes
router.get("/", usersController.getAllUsers);
router.get("/:userId", usersController.getUserById);
router.patch("/:userId", usersController.updateUserStatus);

module.exports = router;