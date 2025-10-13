-------------------------------

ftrainer Colab server (Phase 3: train + eval + download + chat-ready)

-------------------------------

!pip install flask flask-cors pyngrok transformers torch matplotlib --quiet

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pyngrok import ngrok
from transformers import GPT2Tokenizer, GPT2Config, GPT2LMHeadModel
from torch.optim import AdamW
import torch
from torch.utils.data import DataLoader, Dataset
import re, os, json, shutil
import matplotlib.pyplot as plt
from time import time

-------------------------------

CONFIG

-------------------------------

NGROK_AUTHTOKEN = "33Qcjz5EACFmy1NudPRPolLoXXo_81BT1TGswEVa6xeHKUfUR"
CHECKPOINT_DIR = "ftrainer_checkpoint"
LOSS_CURVE_FILE = "loss_curve.png"
MAX_SEQ_LEN = 128

-------------------------------

Setup ngrok

-------------------------------

ngrok.set_auth_token(NGROK_AUTHTOKEN)

-------------------------------

Tokenizer + Model init

-------------------------------

tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
tokenizer.pad_token = tokenizer.eos_token

config = GPT2Config(
vocab_size=tokenizer.vocab_size,
n_positions=1024,
n_ctx=1024,
n_embd=768,
n_layer=12,
n_head=12,
)
model = GPT2LMHeadModel(config)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

Load existing checkpoint if available

if os.path.isdir(CHECKPOINT_DIR) and os.path.exists(os.path.join(CHECKPOINT_DIR, "pytorch_model.bin")):
try:
model = GPT2LMHeadModel.from_pretrained(CHECKPOINT_DIR)
tokenizer = GPT2Tokenizer.from_pretrained(CHECKPOINT_DIR)
tokenizer.pad_token = tokenizer.eos_token
model.to(device)
print("[ftrainer] Loaded previous checkpoint ✅")
except Exception as e:
print("[ftrainer] Could not load checkpoint:", e)

-------------------------------

Flask app setup

-------------------------------

app = Flask(name)
CORS(app)

@app.route("/")
def home():
return "🚀 FTrainer Colab server is running"

-------------------------------

Helpers

-------------------------------

def clean_text(txt):
if not txt: return ""
txt = re.sub(r"\s+", " ", str(txt)).strip()
return txt

def create_dataset(pairs):
data = []
for pair in pairs:
p, r = clean_text(pair.get("prompt")), clean_text(pair.get("response"))
if not p or not r: continue
combined = f"{p} {r}"
tokens = tokenizer(
combined,
truncation=True,
padding="max_length",
max_length=MAX_SEQ_LEN,
return_tensors="pt"
)
data.append({
"prompt": p, "response": r,
"input_ids": tokens["input_ids"].squeeze(0).tolist(),
"attention_mask": tokens["attention_mask"].squeeze(0).tolist()
})
return data

class FTrainerDataset(Dataset):
def init(self, data): self.data = data
def len(self): return len(self.data)
def getitem(self, idx):
item = self.data[idx]
return {
"input_ids": torch.tensor(item["input_ids"], dtype=torch.long),
"attention_mask": torch.tensor(item["attention_mask"], dtype=torch.long),
"labels": torch.tensor(item["input_ids"], dtype=torch.long)
}

def train_on_dataset(dataset_obj, epochs=1, batch_size=2, lr=5e-5):
loader = DataLoader(FTrainerDataset(dataset_obj), batch_size=batch_size, shuffle=True)
optimizer = AdamW(model.parameters(), lr=lr)
model.train()
losses, logs = [], []
start = time()

for epoch in range(epochs):  
    for step, batch in enumerate(loader):  
        input_ids = batch["input_ids"].to(device)  
        mask = batch["attention_mask"].to(device)  
        labels = batch["labels"].to(device)  

        outputs = model(input_ids=input_ids, attention_mask=mask, labels=labels)  
        loss = outputs.loss  
        if not torch.isfinite(loss): continue  

        optimizer.zero_grad()  
        loss.backward()  
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)  
        optimizer.step()  

        losses.append(loss.item())  
        logs.append(f"Epoch {epoch+1}, Step {step+1}/{len(loader)}, Loss: {loss.item():.4f}")  

return logs, losses, time() - start

-------------------------------

Train endpoint

-------------------------------

@app.route("/train", methods=["POST"])
def train_endpoint():
try:
body = request.get_json(force=True)
pairs = body.get("data") if isinstance(body, dict) and body.get("data") else body
if isinstance(pairs, dict): pairs = [pairs]
dataset_obj = create_dataset(pairs)
if len(dataset_obj) == 0:
return jsonify({"success": False, "error": "No valid prompt/response pairs found."}), 400

# adaptive params  
    epochs = 2 if len(dataset_obj) < 50 else 1  
    batch = 1 if len(dataset_obj) < 10 else 2  
    lr = 1e-5 if len(dataset_obj) <= 10 else 5e-5  

    logs, losses, t = train_on_dataset(dataset_obj, epochs, batch, lr)  

    # save checkpoint  
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)  
    model.save_pretrained(CHECKPOINT_DIR)  
    tokenizer.save_pretrained(CHECKPOINT_DIR)  

    # save loss curve  
    if losses:  
        plt.figure(figsize=(6,4))  
        plt.plot(losses)  
        plt.title("FTrainer Training Loss")  
        plt.xlabel("Step")  
        plt.ylabel("Loss")  
        plt.grid(True)  
        plt.tight_layout()  
        plt.savefig(LOSS_CURVE_FILE)  
        plt.close()  

    # create downloadable zip  
    zip_path = "ftrainer_checkpoint.zip"  
    if os.path.exists(zip_path): os.remove(zip_path)  
    shutil.make_archive("ftrainer_checkpoint", "zip", CHECKPOINT_DIR)  

    # construct download URL dynamically  
    download_url = f"{public_url.public_url}/download_checkpoint"  

    return jsonify({  
        "success": True,  
        "dataset_size": len(dataset_obj),  
        "device": str(device),  
        "training_time_seconds": round(t, 2),  
        "training_logs": logs,  
        "checkpoint_dir": CHECKPOINT_DIR,  
        "download_url": download_url,  
        "message": "Training completed. You can now chat with the model via /generate or download the checkpoint."  
    })  

except Exception as e:  
    return jsonify({"success": False, "error": str(e)}), 500

-------------------------------

Chat endpoint

-------------------------------

@app.route("/generate", methods=["POST"])
def generate():
try:
body = request.get_json(force=True)
prompt = clean_text(body.get("prompt"))
if not prompt:
return jsonify({"success": False, "error": "No prompt provided."}), 400

max_new = int(body.get("max_new_tokens", 50))  
    temp = float(body.get("temperature", 0.7))  

    model.eval()  
    input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to(device)  
    with torch.no_grad():  
        gen_ids = model.generate(  
            input_ids,  
            do_sample=True,  
            temperature=temp,  
            max_new_tokens=max_new,  
            pad_token_id=tokenizer.eos_token_id,  
            eos_token_id=tokenizer.eos_token_id  
        )  

    text = tokenizer.decode(gen_ids[0], skip_special_tokens=True)  
    generated = text[len(prompt):].strip() if text.startswith(prompt) else text  
    return jsonify({"success": True, "prompt": prompt, "generated": generated})  
except Exception as e:  
    return jsonify({"success": False, "error": str(e)}), 500

-------------------------------

Download endpoint

-------------------------------

@app.route("/download_checkpoint", methods=["GET"])
def download_checkpoint():
try:
if not os.path.exists("ftrainer_checkpoint.zip"):
shutil.make_archive("ftrainer_checkpoint", "zip", CHECKPOINT_DIR)
return send_file("ftrainer_checkpoint.zip", as_attachment=True)
except Exception as e:
return jsonify({"success": False, "error": str(e)}), 500

-------------------------------

Start server

-------------------------------

public_url = ngrok.connect(5000)
print("🌍 Public ngrok URL:", public_url)
app.run(port=5000)

