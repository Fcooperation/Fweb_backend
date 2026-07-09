const email =
document.getElementById(
  "email"
);

const resetBtn =
document.getElementById(
  "resetBtn"
);

const message =
document.getElementById(
  "message"
);

resetBtn.onclick =
async ()=>{

  const emailValue =
    email.value.trim();

  if(
    !emailValue
  ){

    message.style.display =
    "block";

    message.className =
    "message error";

    message.innerText =
    "Please enter your email address.";

    return;

  }

  resetBtn.disabled =
  true;

  resetBtn.innerText =
  "Sending...";

  message.style.display =
  "none";

  try{

    const res =
    await fetch(
      "https://fweb-backend.onrender.com/forgot-password",
      {
        method:"POST",

        headers:{
          "Content-Type":
          "application/json"
        },

        body:JSON.stringify({
          email:
          emailValue
        })
      }
    );

    const data =
    await res.json();

    message.style.display =
    "block";

    if(
      data.success
    ){

      message.className =
      "message success";

      message.innerText =
        data.message ||
        "Password reset email sent successfully.";

    }
    else{

      message.className =
      "message error";

      message.innerText =
        data.message ||
        "Failed to send email.";

    }

  }
  catch(

  ){

    message.style.display =
    "block";

    message.className =
    "message error";

    message.innerText =
    "Network error. Please try again.";

  }

  resetBtn.disabled =
  false;

  resetBtn.innerText =
  "Send Reset Link";

};