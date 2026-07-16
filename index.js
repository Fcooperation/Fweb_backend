import express from "express";
import cors from "cors";
import multer
from "multer";
import { handleSearch } from "./fcrawler.js";
import login from "./login.js";
import signup from "./signup.js";
import dashboard from "./dashboard.js";
import admin from "./admin.js";
import { fetchImages } from "./fimages.js"; // new
import { fetchVideos } from "./fvids.js";   // new
import { fetchFAI } from "./fai.js";
import { runFTrainer } from "./ftrainer.js";
import { handleFChat } from "./fchat.js";
import fvidLike from "./fvidslike.js";
import fvidUpload from "./fvidUpload.js";
import { postComment, getComments } from "./fvidsComment.js";
import { getSingleVideo } from "./fvids.js";
import fvidShare from "./fvidShare.js";
import tutorialRoutes from "./tutorial.js";
import fvidFollow from "./fvidsfollow.js";
import fvidFollowers from "./fvidsfollowers.js";
import fvidFollowing from "./fvidsfollowing.js";
import followingFeed from "./following.js";
import fvidsUserDetails
  from "./fvidsuserdetails.js";
import fViews from "./fviews.js";
import fvidSearchSuggestions
  from "./fvidsearchsuggestions.js";
import fvidsCommentLikes
  from "./fvidsCommentlikes.js";
import { postReply, getReplies } from "./fvidsreply.js";
import fvidsReplyLikes
  from "./fvidsreplylikes.js";
import fInbox from "./finbox.js";
import fvidCategory from "./fvidscategory.js";
import fvidsExplore from "./fvidsexplore.js";
import account
from "./account.js";
import fvidSearch from "./fvidsearch.js";
import verifyEmail
  from "./verifyemail.js";
import forgotPassword
  from "./forgotpassword.js";
import { fchat_send_message } from "./fchat_send_message.js";// import the main FCHAT handler
import addUser from "./fchat_add.js";
import friendRequest
from "./friendrequest.js";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage()
});

// ------------------------------
// Logging middleware
// ------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[INCOMING] ${req.method} ${req.url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`
    );
  });

  next();
});

// ------------------------------
// Routes
// ------------------------------

// Health check
app.get("/health", (req, res) => res.status(200).send("ok"));

// Root
app.get("/", (req, res) => res.send("Fweb backend is running 🚀"));

// Normal Search
app.get("/search", async (req, res) => {
  console.log(`🔍 Search requested: ${req.query.q}`);
  if (!req.query.q) return res.status(400).json({ error: "No query provided" });

  try {
    const results = await handleSearch(req.query.q);
    res.json(results);
  } catch (err) {
    console.error("❌ Backend error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ------------------------------
// Images search route
// ------------------------------
app.get("/fimages", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const images = await fetchImages(query);
    res.json(images);
  } catch (err) {
    console.error("❌ Images fetch error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ------------------------------
// FVideos get route
// ------------------------------
app.get("/fvids", async (req, res) => {
  try {

    const userId = req.query.userId || null;
    const category = req.query.category || null;

    // ---------------- PAGINATION ----------------
    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 20;

    const videos = await fetchVideos(
      userId,
      category,
      page,
      limit
    );

    return res.json(videos);

  } catch (err) {

    console.error(
      "❌ Videos fetch error:",
      err.message
    );

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }
});

// LOGIN ROUTE
app.post("/login", (req, res) => {
  login(req, res);
});

// SIGNUP ROUTE
app.post("/signup", signup);

// RESEND VERIFICATION EMAIL 
app.post(
  "/verifyemail",
  verifyEmail
);

// FORGOT PASSWORD
app.post(
  "/forgot-password",
  forgotPassword
);

// ACCOUNT ROUTE
app.get(
  "/account",
  account
);

// DASHBOARD ROUTE
app.post(
  "/dashboard",
  upload.single(
    "profile_pic"
  ),
  (req,res)=>{
    dashboard(req,res);
  }
);

// ADD USER ROUTE 
app.get(
  "/add-user",
  addUser
);

app.get(
  "/add-user/search",
  addUser
);

app.post(
  "/add-user",
  addUser
);

// FRIEND REQUESTS
app.get(
  "/friend-request",
  friendRequest
);

app.post(
  "/friend-request/accept",
  friendRequest
);

app.post(
  "/friend-request/reject",
  friendRequest
);

// ADMIN ROUTE
app.post("/admin", async (req, res) => {
  try {
    const result = await admin(req.body);
    res.json(result);
  } catch (err) {
    console.error("❌ Admin error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ------------------------------
// Global error handlers
// ------------------------------
process.on("unhandledRejection", (err) => console.error("❌ Unhandled Rejection:", err));
process.on("uncaughtException", (err) => console.error("❌ Uncaught Exception:", err));
// ------------------------------
// FAI Search route
// ------------------------------
app.get("/fai", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    // fetchFAI returns structured { answer, links: [...] }
    const faiResults = await fetchFAI(query);
    res.json(faiResults);
  } catch (err) {
    console.error("❌ FAI error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

app.post("/fai", async (req, res) => {
  const { userId, messages, prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "No prompt provided" });
  }

  try {
    const result = await fetchFAI({
      userId,
      messages,
      prompt
    });

    res.json(result);

  } catch (err) {
    console.error("❌ FAI POST error:", err.message);
    res.status(500).json({ error: "FAI failed", details: err.message });
  }
});

// ------------------------------
// Training route
// ------------------------------
app.post("/train", async (req, res) => {
  console.log("⚡ Training request received:", req.body);

  try {
    const result = await runFTrainer(req.body); // call ftrainer
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ Training error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------
// Pretrain route
// ------------------------------
app.post("/pretrain", upload.single("model_file"), async (req, res) => {
  console.log("⚡ Pretraining request received");

  if (!req.file) {
    return res.status(400).json({ success: false, error: "No model file uploaded" });
  }

  // Optional: training cycles from formData
  const cycles = parseInt(req.body.cycles) || 1;

  try {
    // Call runFTrainer with 'pretrain' mode
    const result = await runFTrainer({
      mode: "pretrain",        // signal to ftrainer.js this is a pretrain
      modelBuffer: req.file.buffer,
      filename: req.file.originalname,
      cycles
    });

    res.json({ success: true, result });
    console.log(`✅ Pretraining started for ${req.file.originalname}`);
  } catch (err) {
    console.error("❌ Pretraining error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ------------------------------
// Logs route
// ------------------------------
app.post("/logs", async (req, res) => {
  const { round, totalRounds, modelSize, entries, logs: logData } = req.body;

  if (!logData) return res.status(400).json({ success: false, error: "No logs provided" });

  try {
    console.log(`📝 Logs received for round ${round || "-"} (${totalRounds || "-"})`);
    console.log(`Model Size: ${modelSize || "unknown"}, Entries: ${entries || 0}`);
    console.log("------ LOG START ------");
    console.log(logData);
    console.log("------- LOG END -------");

    // Optional: You could also save to a file here if needed

    res.json({ success: true, message: "Logs recorded" });
  } catch (err) {
    console.error("❌ Logs error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------
// FCHAT main route
// ------------------------------
app.post("/fchat", async (req, res) => {
  if (!req.body || !req.body.action) {
    return res.status(400).json({ error: "Missing 'action' in request body" });
  }

  try {
    // Forward the entire JSON body to fchat.js
    const result = await handleFChat(req.body);
    res.json(result); // send back whatever fchat.js returns
  } catch (err) {
    console.error("❌ FCHAT error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// FCHAT SEND MESSAGE ROUTE
app.post("/fchat_send_message", async (req, res) => {
  try {
    const result = await fchat_send_message(req.body); // call your imported function
    res.json(result);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// FVIDS UPLOAD VIDEO ROUTE
app.post(
  "/fvids",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const result = await fvidUpload(req, res);
      return res.json(result);
    } catch (err) {
      console.error("❌ Upload route error:", err);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);

// Fvids like endpoint
app.post("/fvids/like", fvidLike);

// ---------------- COMMENTS ROUTES ----------------
app.post("/fvids/comment", postComment);

app.get("/fvids/comments", getComments);

// ---------------- COMMENT REPLIES ----------------
app.post("/fvids-reply-comments", postReply);

app.get("/fvids-reply-comments", getReplies);

      // ---------------- SINGLE VIDEO ROUTE ----------------
app.get("/fvids/single", async (req, res) => {
  try {

    const videoId = req.query.id;
    const userId = req.query.userId || null;

    const result = await getSingleVideo(
      videoId,
      userId
    );

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Single video error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// FVIDS SHARE VIDEO ROUTE
app.post("/fvids/share", async (req, res) => {
  try {
    const result = await fvidShare(req.body);
    res.json(result);
  } catch (err) {
    console.error("❌ Share error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Tutorials vid load 
app.use("/fvids/tutorials", tutorialRoutes);

// FVIDS FOLLOW ROUTE
app.post("/follow", async (req, res) => {
  try {
    const result = await fvidFollow(req.body);

    res.json(result);

  } catch (err) {
    console.error("❌ Follow error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// FOLLOWING FEED ROUTE
app.get("/fvids/following-feed", async (req, res) => {

  try {

    const result = await followingFeed(req, res);

    res.json(result);

  } catch (err) {

    console.error("❌ Following feed error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- USER DETAILS ROUTE ----------------
app.get("/fvids-user-details", async (req, res) => {

  try {

    const userId =
      req.query.id;

    const viewerId =
      req.query.viewerId || null;

    const result =
      await fvidsUserDetails(
        userId,
        viewerId
      );

    res.json(result);

  } catch (err) {

    console.error(
      "❌ User details error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- GET FOLLOWERS ----------------
app.get("/fvids/followers", async (req, res) => {

  try {

    const userId = req.query.id;

    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 20;

    const result =
      await fvidFollowers(
        userId,
        page,
        limit
      );

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Followers error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- GET FOLLOWING ----------------
app.get("/fvids/following", async (req, res) => {

  try {

    const userId = req.query.id;

    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 20;

    const result =
      await fvidFollowing(
        userId,
        page,
        limit
      );

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Following error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ------------------------------
// FVID SEARCH
// ------------------------------
app.get("/fvidsearch", async (req, res) => {

  try {

    const query = req.query.q || "";

    const results = await fvidSearch(query);

    res.json(results);

  } catch (err) {

    console.error(
      "❌ Fvid search error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// FVIDS VIEW ROUTE
app.post("/fviews", async (req, res) => {

  try {

    const result = await fViews(req.body);

    res.json(result);

  } catch (err) {

    console.error("❌ View error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ------------------------------
// FVID SEARCH SUGGESTIONS
// ------------------------------
app.get("/fvidsearch/suggestions", async (req, res) => {

  try {

    const query = req.query.q || "";

    const results =
      await fvidSearchSuggestions(query);

    res.json(results);

  } catch (err) {

    console.error(
      "❌ Fvid suggestion error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- COMMENT LIKES ----------------
app.post("/fvids-like-comments", async (req, res) => {

  try {

    const result =
      await fvidsCommentLikes(req.body);

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Comment like error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- REPLY LIKES ----------------
app.post("/fvids-like-reply", async (req, res) => {

  try {

    const result =
      await fvidsReplyLikes(req.body);

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Reply like error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- INBOX ----------------
app.post("/finbox", async (req, res) => {

  try {

    const result = await fInbox(req.body);

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Inbox error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ---------------- CATEGORY ----------------
app.post("/fvidscategory", async (req, res) => {
  try {

    await fvidCategory(req, res);

  } catch (err) {

    console.error("❌ Category error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});

// ------------------------------
// FVID EXPLORE
// ------------------------------
app.get("/explore", async (req, res) => {

  try {

    const result = await fvidsExplore(
      req.query
    );

    res.json(result);

  } catch (err) {

    console.error(
      "❌ Explore error:",
      err.message
    );

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ------------------------------
// Start Server
// ------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
