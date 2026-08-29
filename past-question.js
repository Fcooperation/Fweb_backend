import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);


export default async function pastQuestion(req, res) {

  const {
    university,
    course
  } = req.body;


  // ==============================
  // VALIDATION
  // ==============================

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


  // ==============================
  // GET ALL QUESTIONS
  // ==============================

  const {
    data,
    error
  } = await supabase
    .from("fchatstudy")
    .select("*")
    .eq("university", university)
    .eq("course", course)
    .order("year", {
      ascending: false
    })
    .order("question_number", {
      ascending: true
    });


  // ==============================
  // DATABASE ERROR
  // ==============================

  if (error) {

    console.error(
      "❌ Past question error:",
      error
    );

    return {
      success: false,
      error: error.message
    };

  }


  // ==============================
  // NO QUESTIONS
  // ==============================

  if (!data || data.length === 0) {

    return {
      success: true,
      university,
      course,
      total: 0,
      years: [],
      questions: []
    };

  }


  // ==============================
  // GROUP QUESTIONS BY YEAR
  // ==============================

  const grouped = {};


  data.forEach(question => {

    const year =
      question.year || "Unknown Year";


    if (!grouped[year]) {

      grouped[year] = [];

    }


    grouped[year].push(question);

  });


  // ==============================
  // CONVERT GROUPED DATA
  // ==============================

  const years =
    Object.keys(grouped)
      .sort((a, b) => {

        if (
          a === "Unknown Year"
        ) return 1;

        if (
          b === "Unknown Year"
        ) return -1;

        return Number(b) - Number(a);

      })
      .map(year => ({

        year,

        question_count:
          grouped[year].length,

        questions:
          grouped[year]

      }));


  // ==============================
  // RESPONSE
  // ==============================

  return {

    success: true,

    university,

    course,

    total:
      data.length,

    years,

    questions:
      data

  };

}