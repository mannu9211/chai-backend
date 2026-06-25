import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routes import
import userRouter from './routes/user.routes.js';
import videoRouter from './routes/video.routes.js';

const app = express();

// Middleware setup
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);

// Health check route
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({ 
        status: "OK", 
        message: "Server is running successfully" 
    });
});

// Error handling middleware (optional but recommended)
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: err.errors || [],
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
});

export { app };