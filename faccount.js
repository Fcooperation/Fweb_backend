// faccount.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ----------------- Signup -----------------
export async function handleSignup({ firstname, lastname, email, password }) {
  if (!firstname || !lastname || !email || !password) {
    throw new Error("All fields are required for signup.");
  }

  const username = `${firstname} ${lastname}`.trim();

  // Insert into fwebaccount table
  const { data, error } = await supabase
    .from("fwebaccount")
    .insert([
      {
        username,
        email,
        password_hash: password, // TODO: hash in production
        status: "active",
      },
    ])
    .select();

  if (error) throw new Error(error.message);

  return {
    message: "Signup successful",
    account: data[0],
  };
}

// ----------------- Login -----------------
export async function handleLogin({ email, password }) {
  if (!email || !password) {
    throw new Error("Email and password are required for login.");
  }

  const { data, error } = await supabase
    .from("fwebaccount")
    .select("username, email, password_hash")
    .eq("email", email)
    .eq("password_hash", password)
    .single();

  if (error || !data) {
    throw new Error("Invalid credentials");
  }

  return {
    message: "Login successful",
    username: data.username,
    email: data.email,
  };
}

// ----------------- Main handler -----------------
export async function handleAccount(payload) {
  const action = payload.action?.toLowerCase();
  if (action === "signup") {
    // extract firstname/lastname from name
    const [firstname, ...rest] = (payload.name || "").trim().split(" ");
    const lastname = rest.join(" ") || "";
    return await handleSignup({
      firstname,
      lastname,
      email: payload.email,
      password: payload.password,
    });
  } else if (action === "login") {
    return await handleLogin({
      email: payload.email,
      password: payload.password,
    });
  } else {
    throw new Error("Invalid action. Use 'signup' or 'login'.");
  }
}
