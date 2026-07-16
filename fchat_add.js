import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function addUser(
  req,
  res
) {

  try {

 // ---------------- GET USERS ----------------
if (
  req.method === "GET" &&
  !req.query.q
) {

  const page =
    parseInt(req.query.page) || 1;

  const limit =
    parseInt(req.query.limit) || 20;

  const myId =
    req.query.userId || null;

  const from =
    (page - 1) * limit;

  const to =
    from + limit - 1;

  // Get broadcast users only
  const {
    data: fchatUsers,
    error,
    count
  } = await supabase
    .from("fchat")
    .select(`
      user_id,
      status_text,
      broadcast
    `,{
      count:"exact"
    })
    .eq(
      "broadcast",
      true
    )
    .range(
      from,
      to
    );

  if (error) {
    throw error;
  }

  const userIds =
    fchatUsers
      .map(
        u => u.user_id
      )
      .filter(
        id => id !== myId
      );

  const {
    data: users,
    error: usersError
  } = await supabase
    .from("fwebaccount")
    .select(`
      id,
      username,
      profile_pic
    `)
    .in(
      "id",
      userIds
    );

  if (usersError) {
    throw usersError;
  }

  const userMap = {};

  users.forEach(user => {

    userMap[user.id] = user;

  });

  const formatted =
    fchatUsers
      .filter(
        u => u.user_id !== myId
      )
      .map(
        user => ({
          id:
            user.user_id,

          username:
            userMap[
              user.user_id
            ]?.username,

          profile_pic:
            userMap[
              user.user_id
            ]?.profile_pic,

          status_text:
            user.status_text ||
            "Hey there! I'm using FCHAT 👋"
        })
      );

  return res.json({
    success: true,
    users: formatted,
    page,
    hasMore:
      to + 1 <
      (count || 0)
  });

}

// ---------------- SEARCH USERS ----------------
if (
  req.method === "GET" &&
  req.query.q
) {

  const query =
    req.query.q || "";

  if (!query.trim()) {
    return res.json({
      success: true,
      users: []
    });
  }

  let searchQuery =
  supabase
    .from("fwebaccount")
    .select(`
      id,
      username,
      profile_pic
    `)
    .limit(20);

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (
  uuidRegex.test(query)
) {

  searchQuery =
    searchQuery.or(
      `username.ilike.%${query}%,id.eq.${query}`
    );

} else {

  searchQuery =
    searchQuery.ilike(
      "username",
      `%${query}%`
    );

}

const {
  data: users,
  error
} = await searchQuery;

  if (error) {
    throw error;
  }

  const userIds =
    users.map(
      u => u.id
    );

  const {
  data: fchatUsers
} = await supabase
  .from("fchat")
  .select(`
    user_id,
    status_text,
    broadcast
  `)
  .in(
    "user_id",
    userIds
  );

  const fchatMap = {};

  fchatUsers?.forEach(
    user => {

      fchatMap[
        user.user_id
      ] = user;

    }
  );

  return res.json({
    success:true,
   users:
  users.map(
      user => ({
  id:
    user.id,

  username:
    user.username,

  profile_pic:
    user.profile_pic,

  fchat:
    !!fchatMap[
      user.id
    ],

  status_text:
    fchatMap[
      user.id
    ]?.status_text ||

    null,

  broadcast:
    fchatMap[
      user.id
    ]?.broadcast ||
    false
})
    )
  });

}

    // ---------------- ADD USER ----------------
    const {
      senderId,
      receiverId
    } = req.body;

    if (
      !senderId ||
      !receiverId
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Missing senderId or receiverId"
      });

    }

    if (
      senderId === receiverId
    ) {

      return res.status(400).json({
        success: false,
        error:
          "You cannot add yourself"
      });

    }

    const {
      data: existing
    } = await supabase
      .from("friend_request")
      .select("id")
      .or(
`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`
      )
      .maybeSingle();

    if (existing) {

      return res.status(409).json({
        success: false,
        error:
          "Friend request already exists"
      });

    }

    const {
      data,
      error
    } = await supabase
      .from("friend_request")
      .insert([
        {
          user_id:
            senderId,

          friend_id:
            receiverId,

          accepted:
            false,

          created_at:
            new Date()
              .toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      request: data
    });

  } catch (err) {

    console.error(
      "FCHAT ADD ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error:
        err.message
    });

  }

}