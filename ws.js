const ws = new WebSocket("wss://fweb-backend.onrender.com");

ws.onopen = () => {
  console.log("connected ✔");

  ws.send(JSON.stringify({
    type: "register",
    user_id: "test-user"
  }));

  // start backend test loop
  fetch("https://fweb-backend.onrender.com/test");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("SERVER:", data);
};
