import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    uploadVideo,
    getUserVideos,
    getVideoById,
    updateVideoDetails,
    deleteVideo,
    togglePublishStatus,
    searchVideos,
    getTrendingVideos
} from "../controllers/user.controller.js";

const router = Router();

// Video upload - requires authentication
router.route("/upload-video").post(
    verifyJWT,
    upload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 }
    ]),
    uploadVideo
);

// Get user videos - requires authentication
router.route("/videos").get(verifyJWT, getUserVideos);
router.route("/videos/:userId").get(verifyJWT, getUserVideos);

// Get video by ID - public route (no auth required)
router.route("/video/:videoId").get(getVideoById);

// Update video - requires authentication and ownership
router.route("/video/:videoId").patch(verifyJWT, updateVideoDetails);

// Delete video - requires authentication and ownership
router.route("/video/:videoId").delete(verifyJWT, deleteVideo);

// Toggle publish status - requires authentication and ownership
router.route("/video/toggle-publish/:videoId").patch(verifyJWT, togglePublishStatus);

// Search videos - public route
router.route("/search").get(searchVideos);

// Get trending videos - public route
router.route("/trending").get(getTrendingVideos);

export default router;