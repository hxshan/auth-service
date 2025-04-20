import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import { corsOptions } from "./config/corsOptions.js";
import { routes } from "../../user-service/src/routes/index.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors(corsOptions));

routes(app)

const PORT = process.env.PORT || 5002;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`User Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });