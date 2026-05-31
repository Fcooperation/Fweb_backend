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
    course,
    count
  } = body;

  if (!course) {
    return {
      success: false,
      error: "Missing course"
    };
  }

  // -------------------------
  // BUILD QUERY
  // -------------------------
  let query = supabase
    .from("fchatstudy")
    .select("*")
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
// UNKNOWN ACTION
// -------------------------
return {
success: false,
error: "Unknown action"
};
}
