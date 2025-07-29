const Media = require("../models/Media");
const { uploadMediaToCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const uploadMedia = async (req, res) => {
  try {
    logger.info("Media upload started");
    if (!req.file) {
      logger.warn("No file found, Please add a file and try again!");
      return res.status(400).json({
        success: false,
        message: "No file found, Please add a file and try again!",
      });
    }
    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;
    console.log(originalname);

    logger.info(`File details: name-${originalname}, type-${mimetype}`);
    logger.info("Uploading.....");

    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      `Cloudinary upload is successful. Public id-${cloudinaryUploadResult.public_id}`
    );

    const newMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId,
    });
    await newMedia.save();

    res.status(201).json({
      success: true,
      mediaId: newMedia._id,
      url: newMedia.url,
      message: "Media is successfully uploaded!",
    });
  } catch (error) {
    logger.error("Error uploading file", error);
    res.status(500).json({
      success: false,
      message: "Error uploading file",
    });
  }
};

const getAllMedia = async (req, res) => {
  try {
    const allMedias = await Media.find({});
    res.status(200).json({
      success: true,
      allMedias,
    });
  } catch (error) {
    logger.error("Error uploading file", error);
    res.status(500).json({
      success: false,
      message: "Error getting media files",
    });
  }
};

module.exports = { uploadMedia, getAllMedia };
