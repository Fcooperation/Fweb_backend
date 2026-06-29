const account =
  JSON.parse(localStorage.getItem("faccount"));

const viewerId =
  account?.userId || account?.id;

const username =
  document.getElementById("username");

const profilePic =
  document.getElementById("profile-pic");

const stats =
  document.getElementById("profile-stats");

const signInContainer =
  document.getElementById("signin-container");

const videosTab =
  document.getElementById("videos-tab");

// Back button
document
  .getElementById("back-btn")
  .onclick = () => {

  window.location.href =
    "fvids.html";
};

// Sign in button
document
  .getElementById("signin-btn")
  .onclick = () => {

  window.location.href =
    "login.html";
};

// User logged in
if (account) {

  const userId =
    account.userId ||
    account.id;

  username.textContent =
    account.username ||
    account.name ||
    "User";

  if (account.profile_pic) {
    profilePic.src =
      account.profile_pic;
  }

  stats.classList.remove("hidden");
  videosTab.classList.remove("hidden");

  // ---------------- OPEN FOLLOWING ----------------

document
  .getElementById("following-stat")
  .onclick = () => {

    localStorage.setItem(
      "view-follow-user",
      userId
    );

    window.location.href =
      "following.html";

  };

// ---------------- OPEN FOLLOWERS ----------------

document
  .getElementById("followers-stat")
  .onclick = () => {

    localStorage.setItem(
      "view-follow-user",
      userId
    );

    window.location.href =
      "followers.html";

  };
  
  // ---------------- LOAD CACHED PROFILE ----------------

  const cachedProfile =
    JSON.parse(
      localStorage.getItem(
        "fvids-profile"
      )
    );

  if (cachedProfile) {

    console.log(
      "📦 Loaded cached profile:",
      cachedProfile
    );

    updateProfile(
      cachedProfile
    );
  }

  // ---------------- FETCH LATEST PROFILE ----------------

  fetch(
  `https://fweb-backend.onrender.com/fvids-user-details?id=${encodeURIComponent(userId)}&viewerId=${encodeURIComponent(viewerId)}`
)
    .then(res => res.json())
    .then(data => {

      console.log(
        "👤 User details:",
        data
      );

      // Save for offline render
      localStorage.setItem(
        "fvids-profile",
        JSON.stringify(data)
      );

      updateProfile(data);

    })
    .catch(err => {

      console.error(
        "❌ Failed to load profile:",
        err
      );

    });

}

// User not logged in
else {

  username.textContent =
    "Guest";

  signInContainer
    .classList.remove("hidden");

}

// ---------------- PROFILE UPDATE ----------------

function updateProfile(data) {

  if (!data) return;

  const followersEl =
    document.getElementById(
      "followers-count"
    );

  const followingEl =
    document.getElementById(
      "following-count"
    );

  const likesEl =
    document.getElementById(
      "likes-count"
    );

  const videosCountEl =
    document.getElementById(
      "videos-count"
    );

  const videosGrid =
  document.getElementById(
    "videos-grid"
  );
  
  if (followersEl) {

    followersEl.textContent =
      data.followers_count || 0;

  }

  if (followingEl) {

    followingEl.textContent =
      data.following_count || 0;

  }

  if (likesEl) {

    likesEl.textContent =
      data.likes_received || 0;

  }

  if (videosCountEl) {

    videosCountEl.textContent =
      data.videos_count || 0;

  }

  console.log(
    "🎬 User videos:",
    data.videos
  );

  // ---------------- RENDER VIDEOS ----------------
if (videosGrid) {

  videosGrid.innerHTML = "";

  (data.videos || []).forEach((video) => {

    videosGrid.innerHTML += `
      <div
        class="video-card"
        data-public-id="${video.public_id}"
      >

        <div class="thumb-wrap">

          <img
            src="${video.thumbnail_url}"
            class="video-thumbnail"
            loading="lazy"
            alt="Video thumbnail"
          >

          <!-- 👁 VIEWS -->
          <div class="video-views">

            <svg
              class="view-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>

            <span class="view-count">
              ${video.views_count || 0}
            </span>

          </div>

          <!-- ❤️ LIKES -->
<div class="video-likes">

  <span class="like-icon">
    ${video.liked ? "❤️" : "🤍"}
  </span>

  <span class="like-count">
    ${video.likes_count || 0}
  </span>

</div>

        </div>

      </div>
    `;

  });

  // ---------------- OPEN VIDEO ----------------

  videosGrid
    .querySelectorAll(".video-card")
    .forEach((card, index) => {

      card.onclick = () => {

        const selectedVideo = {
          ...data.videos[index],
          user: {
            username: account.username,
            profile_pic: account.profile_pic
          }
        };

        localStorage.setItem(
          "currently_viewing",
          JSON.stringify(selectedVideo)
        );

        localStorage.setItem(
          "redirect",
          "fvidsme.html"
        );

        window.location.href = "fvids.html";

      };

    });

}
}