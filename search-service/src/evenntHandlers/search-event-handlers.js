const { invalidateSearchCache } = require("../controllers/search-controller");
const Search = require("../models/Search");
const logger = require("../utils/logger");

const handlePostCreated = async (event, redisClient) => {
  console.log(event, "event created");
  const { postId, userId, content, createdAt } = event;
  try {
    const newPostForSearch = new Search({
      postId,
      userId,
      content,
      createdAt,
    });
    await newPostForSearch.save();
    await invalidateSearchCache(redisClient, newPostForSearch._id.toString());
    logger.info(`Processed creation of search associated with post ${postId}`);
  } catch (error) {
    logger.error(error, "Error occurred in creating search for post");
  }
};
const handlePostDeleted = async (event, redisClient) => {
  console.log(event, "event delete");
  try {
    await Search.findOneAndDelete({ postId: event.postId });
    await invalidateSearchCache(redisClient, event.postId);
    logger.info(
      `Processed deletion of post associated with search database ${event.postId}`
    );
  } catch (error) {
    logger.error(
      error,
      "Error occurred in deleting the post associated with Search database"
    );
  }
};
module.exports = { handlePostCreated, handlePostDeleted };
