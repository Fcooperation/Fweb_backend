import {
  createClient
}
from "@supabase/supabase-js";

import "dotenv/config";

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY;

const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );


export default async function receiveMessages(
  data
){

  const userId =
    data.userId;

  if(!userId){

    return {
      success: false,
      error: "User ID is required"
    };

  }


  const { data: messages, error } =
    await supabase

    .from("messages")

    .select("*")

    .or(
      `sender_id.eq.${userId},receiver_id.eq.${userId}`
    )

    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if(error){

    throw error;

  }


  return {

    success: true,

    messages:
      messages || []

  };

}