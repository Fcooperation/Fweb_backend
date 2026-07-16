import { createClient }
from "@supabase/supabase-js";

import "dotenv/config";

const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

export default async function friendRequest(
  req,
  res
){

  try{

    // =========================
    // GET FRIEND REQUESTS
    // =========================
    if(
      req.method === "GET"
    ){

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

      // requests sent TO me
      const {
        data: requests,
        error
      } = await supabase
        .from(
          "friend_request"
        )
        .select(`
          user_id
        `)
        .eq(
          "friend_id",
          userId
        )
        .eq(
          "accepted",
          false
        );

      if(error){
        throw error;
      }

      const senderIds =
        requests.map(
          r => r.user_id
        );

      if(
        senderIds.length === 0
      ){

        return res.json({
          success:true,
          requests:[]
        });

      }

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
          senderIds
        );

      if(usersError){
        throw usersError;
      }

      const {
        data: fchatRows
      } = await supabase
        .from("fchat")
        .select(`
          user_id,
          status_text
        `)
        .in(
          "user_id",
          senderIds
        );

      const fchatMap =
        {};

      fchatRows?.forEach(
        row => {

          fchatMap[
            row.user_id
          ] = row;

        }
      );

      const formatted =
        users.map(
          user => ({
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

              "Hey there! I'm using FCHAT 👋"
          })
        );

      return res.json({
        success:true,
        requests:
          formatted
      });

    }

    // =========================
    // ACCEPT REQUEST
    // =========================
    if(
      req.path ===
      "/friend-request/accept"
    ){

      const {
        userId,
        senderId
      } = req.body;

      if(
        !userId ||
        !senderId
      ){

        return res.status(400)
        .json({
          success:false,
          error:
            "Missing userId or senderId"
        });

      }

      // create both directions
      const {
        error
      } = await supabase
        .from(
          "fchat_contact"
        )
        .insert([
          {
            user_id:
              userId,

            friend_id:
              senderId
          },

          {
            user_id:
              senderId,

            friend_id:
              userId
          }
        ]);

      if(error){
        throw error;
      }

      // remove request
      await supabase
        .from(
          "friend_request"
        )
        .delete()
        .eq(
          "user_id",
          senderId
        )
        .eq(
          "friend_id",
          userId
        );

      return res.json({
        success:true
      });

    }

    // =========================
    // REJECT REQUEST
    // =========================
    if(
      req.path ===
      "/friend-request/reject"
    ){

      const {
        userId,
        senderId
      } = req.body;

      if(
        !userId ||
        !senderId
      ){

        return res.status(400)
        .json({
          success:false,
          error:
            "Missing userId or senderId"
        });

      }

      await supabase
        .from(
          "friend_request"
        )
        .delete()
        .eq(
          "user_id",
          senderId
        )
        .eq(
          "friend_id",
          userId
        );

      return res.json({
        success:true
      });

    }

    return res.status(404)
    .json({
      success:false,
      error:
        "Route not found"
    });

  }catch(err){

    console.error(
      "FRIEND REQUEST ERROR:",
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