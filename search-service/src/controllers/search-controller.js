const logger = require("../utils/logger");
const Search = require("../models/Search");

async function invalidateSearchCache(redisClient, input) {
  const cachedKey = `search:${input}`;
  await redisClient.del(cachedKey);
  const keys = await redisClient.keys("search:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}

const searchPostController = async (req, res) => {
  logger.info("Search post endpoint hit!");
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `search:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);
    if (cachedPosts) {
      return res.status(200).json(JSON.parse(cachedPosts));
    }

    const results = await Search.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .skip(startIndex)
      .limit(limit);

    const total = await Search.countDocuments({ $text: { $search: query } });
    const finalResult = {
      results,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    };
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(finalResult));
    res.json(results);
  } catch (error) {
    logger.error("Error searching post", error);
    res.status(500).json({
      success: false,
      message: "Error searching post",
    });
  }
};
module.exports = { searchPostController, invalidateSearchCache };
