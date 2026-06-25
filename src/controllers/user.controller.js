import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false})
        return {accessToken, refreshToken}


    } catch (error) {
        console.log("TOKEN ERROR =>", error);
        throw error;
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validate - not empty
    // check if user already exist
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from reponse
    // check for user creation
    // return res

    console.log("req.headers:", req.headers);
    console.log("req.body:", req.body);

    const { fullname, email, username, password } = req.body || {};
    //console.log("email:", email);

    if(
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser){
        throw new ApiError(409, "User with email or username already esists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage)  && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering a user")
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

const loginUser = asyncHandler(async(req, res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const {email, username, password} = req.body
        if(!username && !email){
            throw new ApiError(400, "username or password is required")

        }
        const user = await User.findOne({
            $or: [{username}, {email}]
        })

        if(!user){
            throw new ApiError(404, "User does not exist")
        }

        const isPasswordValid = 
            await user.isPasswordCorrect(password);

        if(!isPasswordValid){
            throw new ApiError(401, "Invalid user credentials")
        }

        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

        const loggedInUser = await User.findById(user._id).
        select("-password -refreshToken")

        const options = {
            httpOnly : true,
            secure: true
        }
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, 
                    accessToken,
                    refreshToken
                },
                "User logged in Successfully"
            )
        )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            },
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(402, error?.message || "Invalid refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.
    isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave: save})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400, " All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email : email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    } 

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath){
        throw new ApiError(400, "cover image file is missing")
    } 

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url){
        throw new ApiError(400, "Error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "cover Image updated successfully")
    )
})
const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username}  = req.params

    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            },
        },
        {
            $lookup: {
                from:"Subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from:"Subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSusbcribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSusbcribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exist")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory =  asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookuo: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHostory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project:{
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            $first: "$owner"
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            user[0].getWatchHistory,
            "watch history fetched successsfully"
        )
    )
})


// Upload video controller
const uploadVideo = asyncHandler(async (req, res) => {
    // Get video details from request body
    const { title, description, tags } = req.body;

    // Validate required fields
    if (!title?.trim()) {
        throw new ApiError(400, "Title is required");
    }

    if (!description?.trim()) {
        throw new ApiError(400, "Description is required");
    }

    // Check if video file exists
    const videoLocalPath = req.files?.video[0]?.path;
    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    // Check if thumbnail file exists
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail image is required");
    }

    // Upload video and thumbnail to Cloudinary
    const video = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!video?.url) {
        throw new ApiError(400, "Failed to upload video to Cloudinary");
    }

    if (!thumbnail?.url) {
        throw new ApiError(400, "Failed to upload thumbnail to Cloudinary");
    }

    // Process tags if provided
    let tagsArray = [];
    if (tags) {
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    // Create video entry in database
    const videoData = await Video.create({
        videoFile: video.url,
        thumbnail: thumbnail.url,
        title: title.trim(),
        description: description.trim(),
        duration: video.duration || 0,
        owner: req.user._id,
        views: 0,
        isPublished: true
    });

    // Fetch the created video with owner details
    const createdVideo = await Video.findById(videoData._id)
        .populate("owner", "username fullName avatar email");

    if (!createdVideo) {
        throw new ApiError(500, "Something went wrong while uploading video");
    }

    return res.status(201).json(
        new ApiResponse(201, createdVideo, "Video uploaded successfully")
    );
});

// Get all videos for a specific user
const getUserVideos = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10, status = "all" } = req.query;

    // If no userId provided, use the logged-in user
    const targetUserId = userId || req.user._id;

    // Build match condition
    let matchCondition = {
        owner: new mongoose.Types.ObjectId(targetUserId)
    };

    // Filter by status if not "all"
    if (status === "published") {
        matchCondition.isPublished = true;
    } else if (status === "unpublished") {
        matchCondition.isPublished = false;
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
    };

    const pipeline = [
        {
            $match: matchCondition
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            email: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                owner: 1
            }
        }
    ];

    const videos = await Video.aggregatePaginate(
        Video.aggregate(pipeline),
        options
    );

    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );
});

// Get a single video by ID
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required");
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            email: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                tags: 1,
                isPublished: 1,
                createdAt: 1,
                owner: 1
            }
        }
    ]);

    if (!video || video.length === 0) {
        throw new ApiError(404, "Video not found");
    }

    // Increment view count (only if video is published)
    if (video[0].isPublished) {
        await Video.findByIdAndUpdate(videoId, {
            $inc: { views: 1 }
        });
    }

    return res.status(200).json(
        new ApiResponse(200, video[0], "Video fetched successfully")
    );
});

// Update video details
const updateVideoDetails = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description, tags } = req.body;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required");
    }

    // Find the video and verify ownership
    const video = await Video.findOne({
        _id: videoId,
        owner: req.user._id
    });

    if (!video) {
        throw new ApiError(404, "Video not found or you don't have permission to update it");
    }

    // Update fields if provided
    if (title) video.title = title.trim();
    if (description) video.description = description.trim();
    if (tags) {
        video.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    await video.save();

    // Fetch updated video with owner details
    const updatedVideo = await Video.findById(video._id)
        .populate("owner", "username fullName avatar email");

    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
});

// Delete a video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required");
    }

    // Find and delete the video (ensure ownership)
    const video = await Video.findOneAndDelete({
        _id: videoId,
        owner: req.user._id
    });

    if (!video) {
        throw new ApiError(404, "Video not found or you don't have permission to delete it");
    }

    // Optional: Delete from Cloudinary as well
    // You might want to implement a function to delete from Cloudinary
    // const deleteFromCloudinary = async (url) => { ... }
    // await deleteFromCloudinary(video.videoFile);
    // await deleteFromCloudinary(video.thumbnail);

    return res.status(200).json(
        new ApiResponse(200, { deletedVideoId: video._id }, "Video deleted successfully")
    );
});

// Toggle video publish status
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required");
    }

    const video = await Video.findOne({
        _id: videoId,
        owner: req.user._id
    });

    if (!video) {
        throw new ApiError(404, "Video not found or you don't have permission");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res.status(200).json(
        new ApiResponse(200, video, `Video ${video.isPublished ? 'published' : 'unpublished'} successfully`)
    );
});

// Search videos by title, description, or tags
const searchVideos = asyncHandler(async (req, res) => {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query?.trim()) {
        throw new ApiError(400, "Search query is required");
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
    };

    const pipeline = [
        {
            $match: {
                $and: [
                    { isPublished: true },
                    {
                        $or: [
                            { title: { $regex: query, $options: "i" } },
                            { description: { $regex: query, $options: "i" } },
                            { tags: { $in: [query.toLowerCase()] } }
                        ]
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                tags: 1,
                createdAt: 1,
                owner: 1
            }
        }
    ];

    const videos = await Video.aggregatePaginate(
        Video.aggregate(pipeline),
        options
    );

    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );
});

// Get trending videos (most viewed)
const getTrendingVideos = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const videos = await Video.aggregate([
        {
            $match: { isPublished: true }
        },
        {
            $sort: { views: -1, createdAt: -1 }
        },
        {
            $limit: parseInt(limit)
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                tags: 1,
                createdAt: 1,
                owner: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, videos, "Trending videos fetched successfully")
    );
});



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    uploadVideo,
    getUserVideos,
    getVideoById,
    updateVideoDetails,
    deleteVideo,
    togglePublishStatus,
    searchVideos,
    getTrendingVideos
}
