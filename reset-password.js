import {
  createClient
}
from "https://esm.sh/@supabase/supabase-js";

const supabase =
createClient(
  "https://pwsxezhugsxosbwhkdvf.supabase.co",
  "YOUR_ANON_KEY"
);

const password =
document.getElementById(
  "password"
);

const confirmPassword =
document.getElementById(
  "confirmPassword"
);

const resetBtn =
document.getElementById(
  "resetBtn"
);

const message =
document.getElementById(
  "message"
);

// --------------------
// CHECK RECOVERY SESSION
// --------------------

const {
  data:{
    session
  }
} =
await supabase
.auth
.getSession();

if(
  !session
){

  message.style.display =
  "block";

  message.className =
  "message error";

  message.innerText =
  "Invalid or expired reset link.";

  setTimeout(
    ()=>{
      location.href =
      "/login";
    },
    2500
  );

}

// --------------------
// RESET PASSWORD
// --------------------

resetBtn.onclick =
async ()=>{

  message.style.display =
  "none";

  if(
    password.value.length < 6
  ){

    message.style.display =
    "block";

    message.className =
    "message error";

    message.innerText =
    "Password must be at least 6 characters.";

    return;

  }

  if(
    password.value !==
    confirmPassword.value
  ){

    message.style.display =
    "block";

    message.className =
    "message error";

    message.innerText =
    "Passwords do not match.";

    return;

  }

  resetBtn.disabled =
  true;

  resetBtn.innerText =
  "Updating...";

  const {
    error
  } =
  await supabase
  .auth
  .updateUser({

    password:
    password.value

  });

  if(
    error
  ){

    message.style.display =
    "block";

    message.className =
    "message error";

    message.innerText =
    error.message;

    resetBtn.disabled =
    false;

    resetBtn.innerText =
    "Update Password";

    return;

  }

  message.style.display =
  "block";

  message.className =
  "message success";

  message.innerText =
  "Password updated successfully. Redirecting to login...";

  setTimeout(
    ()=>{

      location.href =
      "/login";

    },
    2500
  );

};