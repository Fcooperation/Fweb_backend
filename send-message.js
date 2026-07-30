import {
createClient
}
from "@supabase/supabase-js";

import "dotenv/config";

const supabaseUrl =
process.env.SUPABASE_URL;

const supabaseKey =
process.env.SUPABASE_KEY;

const supabase =
createClient(
supabaseUrl,
supabaseKey
);

export default async function sendMessage(
data
){

try{

const {

messageId,

senderId,

receiverId,

message,

replyToId

} = data;

const {
error
} =
await supabase
.from("messages")
.insert({

message_id:
messageId,

sender_id:
senderId,

receiver_id:
receiverId,

message,

reply_to_id:
replyToId,

status:
"sent"

});

if(error){

console.error(
error
);

return{

success:false,

message:
error.message

};

}

return{

success:true,

message:
"Message sent"

};

}catch(err){

console.error(
err
);

return{

success:false,

message:
err.message

};

}

}