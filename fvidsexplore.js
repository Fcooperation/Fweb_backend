import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidsExplore(query) {

  const {
    section,
    page = 1
  } = query;

  const limit = 20;

  const from =
    (Number(page) - 1) * limit;

  const to =
    from + limit - 1;

  // ---------------- TRENDING ----------------

  if (section === "trending") {

    const { data, error } =
  await supabase
    .from("fvids")
    .select("*")
    .limit(200);

    if (error) {
      throw error;
    }

    data.sort((a, b) => {

  const scoreA =
      (a.views_count || 0)
    + (a.likes_count || 0) * 5
    + (a.comment_count || 0) * 8
    + (a.share_count || 0) * 10;

  const scoreB =
      (b.views_count || 0)
    + (b.likes_count || 0) * 5
    + (b.comment_count || 0) * 8
    + (b.share_count || 0) * 10;

  return scoreB - scoreA;

});



    // ---------- Fetch uploaders ----------

    const userIds = [
      ...new Set(
        (data || [])
          .map(v => v.user_id)
          .filter(Boolean)
      )
    ];

    let usersMap = {};

    if (userIds.length) {

      const {
        data: users
      } = await supabase
        .from("fwebaccount")
        .select(
          "id,username,profile_pic"
        )
        .in("id", userIds);

      usersMap = Object.fromEntries(
        (users || []).map(user => [
          String(user.id),
          user
        ])
      );

    }

    const pageVideos =
  data.slice(from, to + 1);

const items =
  pageVideos.map(video => ({

        ...video,

        user:
          usersMap[
            String(video.user_id)
          ] || null,

        username:
          usersMap[
            String(video.user_id)
          ]?.username || null,

        profile_pic:
          usersMap[
            String(video.user_id)
          ]?.profile_pic || null,

        likes: undefined

      }));

    return {

      items,

      hasMore:
        items.length === limit

    };

  }

  // ---------------- UNKNOWN SECTION ----------------

  return {

    items: [],

    hasMore: false

  };

}