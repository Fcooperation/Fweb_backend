import WebSocket from "ws";

const ws = new WebSocket("wss://fweb-backend.onrender.com");

ws.on("open", () => {
  console.log("connected");

  ws.send(JSON.stringify({
    type: "register",
    user_id: "node-test"
  }));

  fetch("https://fweb-backend.onrender.com/test");
});

ws.on("message", (msg) => {
  console.log("SERVER:", msg.toString());
});
