import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

export async function getFAIModels() {

  if (!ACCOUNT_ID) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is missing from .env"
    );
  }

  if (!API_TOKEN) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is missing from .env"
    );
  }

  const url =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${ACCOUNT_ID}/ai/models/search` +
    `?per_page=100`;

  const response = await fetch(url, {
    method: "GET",

    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json();

  if (!response.ok || !data.success) {

    console.error(
      "❌ Cloudflare model search error:",
      data
    );

    throw new Error(
      data?.errors?.[0]?.message ||
      `Cloudflare model search failed (${response.status})`
    );
  }

  const models = Array.isArray(data.result)
    ? data.result
    : [];

  // Keep image-related models only
  const imageModels = models.filter(model => {

    const task =
      String(model.task || "").toLowerCase();

    const name =
      String(
        model.name ||
        model.id ||
        model.model ||
        ""
      ).toLowerCase();

    const description =
      String(
        model.description || ""
      ).toLowerCase();

    return (
      task.includes("image") ||
      task.includes("text-to-image") ||
      task.includes("img2img") ||
      task.includes("inpaint") ||
      name.includes("flux") ||
      name.includes("stable-diffusion") ||
      description.includes("image generation") ||
      description.includes("image editing") ||
      description.includes("img2img")
    );

  });

  return {

    success: true,

    totalModels: models.length,

    imageModels: imageModels.length,

    models: imageModels.map(model => ({

      id:
        model.id ||
        model.name ||
        model.model,

      name:
        model.name ||
        model.id ||
        model.model,

      task:
        model.task || null,

      description:
        model.description || null,

      source:
        model.source || null,

      supported:
        model.supported || null,

      capabilities:
        model.capabilities || null

    }))

  };

}