const Media = require("../models/Media");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const handlePostDeleted = async (event) => {
  console.log(event, "event delete");
  const { postId, mediaIds } = event;
  try {
    const mediaToDelete = await Media.find({ _id: { $in: mediaIds } });
    for (const media of mediaToDelete) {
      await deleteMediaFromCloudinary(media.publicId);
      await Media.findByIdAndDelete(media);
      logger.info(
        `Deleted media ${media._id} associated with deleted post ${postId}`
      );
    }
    logger.info(`Processed deletion of media associated with post ${postId}`);
  } catch (error) {
    logger.error(error, "Error occurred in deleting the media");
  }
};
module.exports = { handlePostDeleted };
