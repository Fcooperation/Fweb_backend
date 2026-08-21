import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
supabaseUrl,
supabaseKey
);

export default async function admin(body) {

const { action } = body;

// -------------------------
// ADD STUDY QUESTION
// -------------------------
if (action === "add_study_question") {

const {
  id,
  university,
  course,
  question,
  options,
  answer,
  formula,
  explanation,
  difficulty,
  topic,
  type,
  year,
  session,
  question_number,
  xp_reward,
  instructor,
  verified

} = body;

if (
  !id ||
  !university ||
  !question ||
  !answer
) {
  return {
    success: false,
    error: "Missing required fields"
  };
}

const { data, error } =
  await supabase
    .from("fchatstudy")
    .insert([
{
  id,
  university,
  course,
  question,
  options,
  answer,
  formula,
  explanation,
  difficulty,
        topic,
        type,
        year,
        session,
        question_number,
        xp_reward,
        instructor,
        verified
      }
    ])
    .select();

if (error) {
  console.error(error);

  return {
    success: false,
    error: error.message
  };
}

return {
  success: true,
  message: "Question added",
  data
};

}
  
//Get quiz 
  if (action === "get_quiz") {

  const {
  university,
  course,
  count
} = body;

  if (!university || !course) {
  return {
    success: false,
    error: "Missing university or course"
  };
}

  // -------------------------
  // BUILD QUERY
  // -------------------------
  let query = supabase
  .from("fchatstudy")
  .select("*")
  .eq("university", university)
  .eq("course", course);

  // -------------------------
  // LIMIT QUESTIONS
  // -------------------------
  if (count && count !== "all") {
    query = query.limit(count);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);

    return {
      success: false,
      error: error.message
    };
  }

// -------------------------
// RETURN QUIZ DATA
// -------------------------
return {
  success: true,
  course,
  total: data.length,
  questions: data
};

}


// -------------------------
// GET UNIVERSITIES
// -------------------------
if (action === "get_universities") {

  const { data, error } =
    await supabase
      .from("fchatstudy")
      .select("university");

  if (error) {

    console.error(error);

    return {
      success: false,
      error: error.message
    };

  }

  const universities = [
    ...new Set(
      data
        .map(row => row.university)
        .filter(Boolean)
    )
  ];

  return {
    success: true,
    universities
  };

}

// -------------------------
// GET COURSES
// -------------------------
if (action === "get_courses") {

  const { university } = body;

  if (!university) {
    return {
      success: false,
      error: "Missing university"
    };
  }

  const { data, error } =
    await supabase
      .from("fchatstudy")
      .select("course")
      .eq("university", university);

  if (error) {

    console.error(error);

    return {
      success: false,
      error: error.message
    };

  }

  const courses = [
    ...new Set(
      data
        .map(row => row.course)
        .filter(Boolean)
    )
  ];

  return {
    success: true,
    university,
    courses
  };

}


// -------------------------
// UNKNOWN ACTION
// -------------------------
return {
  success: false,
  error: "Unknown action"
};

}