import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import mergedRoutes from "./routes/mergedRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "API is healthy" });
});

// Routes
app.use("/api", mergedRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("MicroCourse Forge API is running...");
});

// DB connection & server start
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
