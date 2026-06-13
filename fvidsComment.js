import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Lazy-load the client: Create it only when needed, and cache it
let cachedSupabase = null;

function getSupabase() {
  if (!cachedSupabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error("Missing Supabase environment variables!");
    }
    cachedSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return cachedSupabase;
}

// ---------------- MAIN HANDLER ----------------
export default async function fvidsComment(req, res) {
  try {
    const supabase = getSupabase(); // Get the client safely
    
    if (req.method === "POST") return await postComment(req, res, supabase);
    if (req.method === "GET") return await getComments(req, res, supabase);

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("COMMENTS ROUTE ERROR:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

// Pass the supabase instance down to the functions
async function postComment(req, res, supabase) {
  const { videoId, videoUrl, userId, commentText } = req.body;
  // ... rest of your code using 'supabase'
  // Remember to add the Number() fix here too!
}

async function getComments(req, res, supabase) {
  // ... rest of your code using 'supabase'
  // Use Number(req.query.page) and Number(req.query.limit)
}
