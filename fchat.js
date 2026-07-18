import { createClient }
from "@supabase/supabase-js";

import "dotenv/config";

const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

export default async function fchat(
  req,
  res
){

  try{

    const userId =
      req.query.userId;

    if(!userId){

      return res.status(400)
      .json({
        success:false,
        error:
          "Missing userId"
      });

    }

    // My contacts
    const {
      data: contacts,
      error
    } = await supabase
      .from(
        "fchat_contacts"
      )
      .select(`
        friend_id
      `)
      .eq(
        "user_id",
        userId
      );

    if(error){
      throw error;
    }

    const friendIds =
      contacts.map(
        c => c.friend_id
      );

    if(
      friendIds.length === 0
    ){

      return res.json({
        success:true,
        contacts:[]
      });

    }

    // Account details
    const {
      data: users,
      error: usersError
    } = await supabase
      .from(
        "fwebaccount"
      )
      .select(`
        id,
        username,
        profile_pic
      `)
      .in(
        "id",
        friendIds
      );

    if(usersError){
      throw usersError;
    }

    // FCHAT status
    const {
      data: fchatRows,
      error: fchatError
    } = await supabase
      .from(
        "fchat"
      )
      .select(`
        user_id,
        status_text
      `)
      .in(
        "user_id",
        friendIds
      );

    if(fchatError){
      throw fchatError;
    }

    const fchatMap =
      {};

    fchatRows.forEach(
      row=>{

        fchatMap[
          row.user_id
        ] = row;

      }
    );

    const formatted =
      users.map(
        user=>({

          id:
            user.id,

          username:
            user.username,

          profile_pic:
            user.profile_pic,

          status_text:
            fchatMap[
              user.id
            ]?.status_text ||

            "Hey there! I'm using FCHAT 👋",

          // Placeholder until messages exist
          last_message:
            "",

          unread_count:
            0

        })
      );

    return res.json({

      success:true,

      contacts:
        formatted

    });

  }catch(err){

    console.error(
      "FCHAT CONTACTS ERROR:",
      err
    );

    return res.status(500)
    .json({

      success:false,

      error:
        err.message

    });

  }

}