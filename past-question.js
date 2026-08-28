export default async function pastQuestion(req, res) {

  const {
    university,
    course
  } = req.body;

  const images =
    req.files || [];


  // ------------------------------
  // VALIDATION
  // ------------------------------

  if (!university) {

    return {
      success: false,
      error: "University is required"
    };

  }

  if (!course) {

    return {
      success: false,
      error: "Course is required"
    };

  }


  // ------------------------------
  // IMAGE INFORMATION
  // ------------------------------

  const imageInfo =
    images.map(file => ({
      name: file.originalname,
      type: file.mimetype,
      size: file.size
    }));


  // ------------------------------
  // TEMPORARY RESPONSE
  // ------------------------------

  return {

    success: true,

    university,

    course,

    images: imageInfo

  };

}