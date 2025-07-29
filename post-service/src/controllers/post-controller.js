const Post = require("../models/Post");
const logger = require("../utils/logger");
const { publishEvent } = require("../utils/rabbitmq");
const { validateCreatePost } = require("../utils/validation");

async function invalidatePostCache(req, input) {
  const cachedKey = `post:${input}`;
  await req.redisClient.del(cachedKey);
  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }
}

const createPost = async (req, res) => {
  try {
    logger.info("create post endpoint hit!");
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { content, mediaIds } = req.body;
    const newPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newPost.save();
    //publish post create method ->
    await publishEvent("post.created", {
      postId: newPost._id.toString(),
      userId: req.user.userId,
      content: newPost.content,
      createdAt: newPost.createdAt,
    });
    await invalidatePostCache(req, newPost._id.toString());
    logger.info("post created", newPost);
    res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (error) {
    logger.error("Error creating post", error);
    res.status(500).json({
      success: false,
      message: "Error creating post",
    });
  }
};

const getAllPosts = async (req, res) => {
  try {
    logger.info("get all posts endpoint hit!");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);
    if (cachedPosts) {
      return res.status(200).json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const totalPosts = await Post.countDocuments();

    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
    };

    // save posts in cache for 300 seconds
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));

    res.status(200).json(result);
  } catch (error) {
    logger.error("Error fetching posts", error);
    res.status(500).json({
      success: false,
      message: "Error fetching posts",
    });
  }
};

const getPost = async (req, res) => {
  try {
    logger.info("get single post endpoint hit!");
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPosts = await req.redisClient.get(cacheKey);
    if (cachedPosts) {
      return res.status(200).json(JSON.parse(cachedPosts));
    }
    const singlePostById = await Post.findById(postId);
    if (!singlePostById) {
      return res.status(404).json({
        success: false,
        message: "No post found with this id",
      });
    }
    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(singlePostById));

    res.status(200).json(singlePostById);
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post",
    });
  }
};

const deletePost = async (req, res) => {
  try {
    logger.info("delete post endpoint hit!");
    const postId = req.params.id;
    const deletedPost = await Post.findOneAndDelete({
      _id: postId,
      user: req.user.userId,
    });
    if (!deletedPost) {
      return res.status(404).json({
        success: false,
        message: "Post is not found for this user!",
      });
    }

    //publish post delete method ->
    await publishEvent("post.deleted", {
      postId: deletedPost._id.toString(),
      userId: req.user.userId,
      mediaIds: deletedPost.mediaIds,
    });

    await invalidatePostCache(req, postId);
    logger.info("Post deleted", deletedPost);
    res.status(201).json({
      success: true,
      message: "Post is successfully deleted",
    });
  } catch (error) {
    logger.error("Error deleting post", error);
    res.status(500).json({
      success: false,
      message: "Error deleting post",
    });
  }
};
module.exports = { createPost, getAllPosts, getPost, deletePost };
