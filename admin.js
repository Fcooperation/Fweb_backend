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
  exam_question_count:
    Number(data[0]?.exam_question_count) || 35,
  exam_time_limit:
    Number(data[0]?.exam_time_limit) || 25,
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
// ADD XP TO ACCOUNT
// -------------------------
if (action === "add_xp") {

  const {
    user_id,
    xp
  } = body;

  if (!user_id || !xp) {
    return {
      success: false,
      error: "Missing user_id or xp"
    };
  }

  const { data: account, error: fetchError } =
    await supabase
      .from("fwebaccount")
      .select("xp")
      .eq("id", user_id)
      .single();

  if (fetchError) {
    console.error(fetchError);

    return {
      success: false,
      error: fetchError.message
    };
  }

  const currentXP = account.xp || 0;
  const newXP = currentXP + Number(xp);

  const { data, error } =
    await supabase
      .from("fwebaccount")
      .update({
        xp: newXP
      })
      .eq("id", user_id)
      .select("id, xp")
      .single();

  if (error) {
    console.error(error);

    return {
      success: false,
      error: error.message
    };
  }

  return {
    success: true,
    message: "XP added",
    xp_added: Number(xp),
    total_xp: data.xp
  };

}

// -------------------------
// DEDUCT XP FROM ACCOUNT
// -------------------------
if (action === "deduct_xp") {

  const {
    user_id,
    amount
  } = body;

  if (!user_id || !amount) {
    return {
      success: false,
      error: "Missing user_id or amount"
    };
  }

  const deduction = Number(amount);

  if (!Number.isFinite(deduction) || deduction <= 0) {
    return {
      success: false,
      error: "Invalid XP amount"
    };
  }

  const { data: account, error: fetchError } =
    await supabase
      .from("fwebaccount")
      .select("xp")
      .eq("id", user_id)
      .single();

  if (fetchError) {

    console.error(fetchError);

    return {
      success: false,
      error: fetchError.message
    };

  }

  const currentXP = Number(account.xp) || 0;

  // Not enough XP
  if (currentXP < deduction) {

    return {
      success: false,
      error: "Not enough XP",
      current_xp: currentXP,
      required_xp: deduction
    };

  }

  const newXP = currentXP - deduction;

  const { data, error } =
    await supabase
      .from("fwebaccount")
      .update({
        xp: newXP
      })
      .eq("id", user_id)
      .select("id, xp")
      .single();

  if (error) {

    console.error(error);

    return {
      success: false,
      error: error.message
    };

  }

  return {
    success: true,
    message: "XP deducted",
    xp_deducted: deduction,
    total_xp: data.xp
  };

}

// -------------------------
// UPLOAD FSTUDY NOTE
// -------------------------
if (action === "upload_notes") {

  const {
    id,
    university,
    course,
    title,
    topic,
    uploaded_by,
    sections
  } = body.note || {};


  // -------------------------
  // VALIDATE NOTE
  // -------------------------

  if (
    !university ||
    !course ||
    !title ||
    !uploaded_by
  ) {
    return {
      success: false,
      error: "Missing required note fields"
    };
  }


  if (
    !Array.isArray(sections) ||
    sections.length === 0
  ) {
    return {
      success: false,
      error: "Note must contain at least one section"
    };
  }


  // -------------------------
  // GENERATE ID
  // -------------------------

  const noteId =
    id ||
    crypto.randomUUID();


  // -------------------------
  // INSERT NOTE
  // -------------------------

  const { data: note, error: noteError } =
    await supabase
      .from("fstudy_notes")
      .insert([
        {
          id: noteId,
          university,
          course,
          title,
          topic,
          uploaded_by
        }
      ])
      .select()
      .single();


  if (noteError) {

    console.error(noteError);

    return {
      success: false,
      error: noteError.message
    };

  }


  // -------------------------
  // PREPARE SECTIONS
  // -------------------------

  const sectionRows =
    sections.map((section, index) => ({

      note_id: noteId,

      title:
        section.title,

      content:
        section.content,

      section_order:
        Number(section.section_order) ||
        index + 1

    }));


  // -------------------------
  // INSERT SECTIONS
  // -------------------------

  const {
    data: insertedSections,
    error: sectionError
  } =
    await supabase
      .from("fstudy_note_sections")
      .insert(sectionRows)
      .select();


  if (sectionError) {

    console.error(sectionError);


    // Remove note if sections failed
    await supabase
      .from("fstudy_notes")
      .delete()
      .eq("id", noteId);


    return {
      success: false,
      error: sectionError.message
    };

  }


  // -------------------------
  // SUCCESS
  // -------------------------

  return {
    success: true,
    message: "Note uploaded successfully",
    note,
    sections: insertedSections
  };

}

//Retrieve Notes
if (action === "retrieve_notes_topics") {

  const {
    university,
    course
  } = body;


  if (!university || !course) {

    return {
      success: false,
      error: "Missing university or course"
    };

  }


  const { data, error } =
    await supabase
      .from("fstudy_notes")
      .select("topic")
      .eq("university", university)
      .eq("course", course);


  if (error) {

    console.error(error);

    return {
      success: false,
      error: error.message
    };

  }


  const topics = [
    ...new Set(
      data
        .map(row => row.topic)
        .filter(Boolean)
    )
  ];


  return {
    success: true,
    university,
    course,
    topics
  };

}

// -------------------------
// RETRIEVE FSTUDY NOTE
// -------------------------
if (action === "retrieve_note") {

const {
university,
course,
topic
} = body;

// -------------------------
// VALIDATE
// -------------------------

if (
!university ||
!course ||
!topic
) {

return {
  success: false,
  error:
    "Missing university, course or topic"
};

}

// -------------------------
// FIND NOTE
// -------------------------

const {
data: note,
error: noteError
} =
await supabase
.from("fstudy_notes")
.select("*")
.eq("university", university)
.eq("course", course)
.eq("topic", topic)
.limit(1)
.single();

if (noteError) {

console.error(noteError);

return {
  success: false,
  error: noteError.message
};

}

// -------------------------
// GET SECTIONS
// -------------------------

const {
data: sections,
error: sectionError
} =
await supabase
.from("fstudy_note_sections")
.select("*")
.eq("note_id", note.id)
.order("section_order", {
ascending: true
});

if (sectionError) {

console.error(sectionError);

return {
  success: false,
  error: sectionError.message
};

}

// -------------------------
// RETURN NOTE
// -------------------------

return {

success: true,

note,

sections:
  sections || []

};

}

// -------------------------
// RETRIEVE PAST QUESTIONS
// -------------------------
if (action === "retrieve_past_questions") {

  const {
    university,
    course,
    year
  } = body;


  // -------------------------
  // VALIDATE
  // -------------------------

  if (
    !university ||
    !course ||
    !year
  ) {

    return {
      success: false,
      error:
        "University, course and year are required."
    };

  }


  // -------------------------
  // GET QUESTIONS
  // -------------------------

  const {
    data,
    error
  } =
    await supabase
      .from("fchatstudy")
      .select("*")
      .eq(
        "university",
        university
      )
      .eq(
        "course",
        course
      )
      .eq(
        "year",
        year
      )
      .order(
        "question_number",
        {
          ascending: true
        }
      );


  // -------------------------
  // DATABASE ERROR
  // -------------------------

  if (error) {

    console.error(error);

    return {
      success: false,
      error: error.message
    };

  }


  // -------------------------
  // SUCCESS
  // -------------------------

  return {
    success: true,

    university,
    course,
    year,

    total:
      data ? data.length : 0,

    questions:
      data || []

  };

}

/* =========================
   TRANSLATE SECTION
========================= */

if (action === "translate_section") {

  try {

    const {
      text,
      target_language
    } = body;


    // -------------------------
    // VALIDATE
    // -------------------------

    if (
      !text ||
      !text.trim()
    ) {

      return {
        success: false,
        error:
          "No section content provided."
      };

    }


    // -------------------------
    // TRANSLATION PROMPT
    // -------------------------

    const prompt = `
You are a professional translator for FSTUDY.

Translate the provided academic text into clear, natural English.

IMPORTANT RULES:

1. Translate ONLY the provided text.
2. Do not summarize it.
3. Do not remove information.
4. Do not add new information.
5. Preserve the original meaning.
6. Preserve academic terminology.
7. Preserve headings where possible.
8. Preserve bullet points and numbering.
9. If a word or phrase is already English, keep it.
10. The source may be Igbo or mixed Igbo and English.
11. Return ONLY the translated text.
12. Do not add explanations before or after the translation.

TARGET LANGUAGE:

${target_language || "English"}

SOURCE TEXT:

${text}
`;


    // -------------------------
    // GEMINI
    // -------------------------

    const result =
      await geminiModel.generateContent(
        prompt
      );


    const translation =
      result.response
        .text()
        .trim();


    if (!translation) {

      throw new Error(
        "Gemini returned an empty translation."
      );

    }


    // -------------------------
    // SUCCESS
    // -------------------------

    return {

      success: true,

      translation

    };


  } catch (error) {

    console.error(
      "Translation error:",
      error
    );

    return {

      success: false,

      error:
        "Failed to translate section."

    };

  }

}

// -------------------------
// UNKNOWN ACTION
// -------------------------
return {
  success: false,
  error: "Unknown action"
};

}