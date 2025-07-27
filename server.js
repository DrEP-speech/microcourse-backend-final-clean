import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import mergedRoutes from "./routes/mergedRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware (must come before routes)
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ✅ Health check route
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Main API routes
app.use("/api", mergedRoutes);

// ✅ Database connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI not set");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
