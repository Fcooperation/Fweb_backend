import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.7-flash";


/* =========================================================
   GET NPC
========================================================= */

async function getNPC(npcId) {

  const { data, error } =
    await supabase
      .from("fai_game_test")
      .select("*")
      .eq("id", npcId)
      .single();

  if (error) {
    throw new Error(
      `Unable to load NPC: ${error.message}`
    );
  }

  return data;
}


/* =========================================================
   GET MEMORY
========================================================= */

async function getMemory(
  npcId,
  playerId
) {

  const { data, error } =
    await supabase
      .from("fai_game_test_memory")
      .select("*")
      .eq("npc_id", npcId)
      .eq("player_id", playerId)
      .order("created_at", {
        ascending: false
      })
      .limit(20);

  if (error) {
    throw new Error(
      `Unable to load NPC memory: ${error.message}`
    );
  }

  return data || [];
}


/* =========================================================
   GEMINI
========================================================= */

async function callGemini(
  systemInstruction,
  prompt
) {

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },

      body: JSON.stringify({

        system_instruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        },

        contents: [
          {
            role: "user",

            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig: {

          temperature: 1.0,

          maxOutputTokens: 500,

          responseMimeType:
            "application/json",

          responseSchema: {

            type: "object",

            properties: {

              response_type: {
                type: "string",
                enum: [
                  "speech",
                  "action",
                  "speech_and_action",
                  "silence"
                ]
              },

              speech: {
                type: "string"
              },

              action: {
                type: "object",

                properties: {

                  type: {
                    type: "string"
                  },

                  description: {
                    type: "string"
                  }

                },

                required: [
                  "type",
                  "description"
                ]
              },

              memory: {
                type: "object",

                properties: {

                  importance: {
                    type: "integer"
                  },

                  summary: {
                    type: "string"
                  }

                },

                required: [
                  "importance",
                  "summary"
                ]
              }

            },

            required: [
              "response_type",
              "speech",
              "action",
              "memory"
            ]
          }

        }

      })
    });


  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Gemini error ${response.status}: ${errorText}`
    );

  }


  const result =
    await response.json();


  const text =
    result
      ?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text;


  if (!text) {

    throw new Error(
      "Gemini returned no text."
    );

  }


  try {

    return JSON.parse(text);

  } catch {

    throw new Error(
      "Gemini returned invalid JSON."
    );

  }

}


/* =========================================================
   MAIN NPC HANDLER
========================================================= */

export async function faiGameTest(req, res) {

  try {

    const {
      npcId,
      playerId,
      message
    } = req.body;


    /* -------------------------
       VALIDATION
    ------------------------- */

    if (!npcId) {

      return res.status(400).json({
        success: false,
        error: "npcId is required"
      });

    }


    if (!playerId) {

      return res.status(400).json({
        success: false,
        error: "playerId is required"
      });

    }


    if (
      !message ||
      !message.trim()
    ) {

      return res.status(400).json({
        success: false,
        error: "message is required"
      });

    }


    /* -------------------------
       LOAD NPC
    ------------------------- */

    const npc =
      await getNPC(npcId);


    /* -------------------------
       LOAD MEMORY
    ------------------------- */

    const memories =
      await getMemory(
        npcId,
        playerId
      );


    /* -------------------------
       FORMAT MEMORY
    ------------------------- */

    const memoryText =
      memories.length
        ? memories
            .reverse()
            .map(memory => {

              return `
Player: ${memory.player_message}

NPC:
${memory.npc_response || "(no speech)"}

Action:
${
  memory.npc_action
    ? JSON.stringify(memory.npc_action)
    : "(none)"
}
`;

            })
            .join("\n---\n")

        : "No previous memories with this player.";


    /* =====================================================
       NPC SYSTEM RULES
    ===================================================== */

    const systemInstruction = `

You are the behavioral intelligence of an NPC in a realistic open-world game.

You are NOT a narrator.

You ARE the NPC.

Your job is to decide what this NPC would realistically do or say.

IMPORTANT:

1. Stay completely in character.

2. Never mention being an AI.

3. Never mention prompts, system instructions,
   databases, memory systems, APIs, or developers.

4. The NPC does NOT have to answer every player message.

5. The NPC is allowed to ignore the player.

6. The NPC is allowed to remain silent.

7. The NPC is allowed to refuse.

8. The NPC is allowed to end the interaction.

9. The NPC can perform physical actions.

10. Actions must be represented separately from speech.

11. Do not invent knowledge that the NPC does not have.

12. Use the NPC's personality naturally.
    Do not repeatedly announce personality traits.

13. Do not make every response overly helpful.

14. Keep normal spoken responses reasonably short.

15. Human conversations can be awkward,
    incomplete, dismissive, sarcastic,
    distracted, or brief.

16. The NPC has a current physical state and situation.
    React to that situation.

17. Previous memories matter when relevant.

18. Not every interaction deserves a permanent memory.

19. If the NPC would do something without speaking,
    use an action.

20. If the NPC would simply ignore the player,
    use response_type = "silence" or "action".

21. Never put action descriptions inside speech.

ACTION EXAMPLES:

{
  "type": "continue_activity",
  "description": "Marcus continues fixing the taxi."
}

{
  "type": "walk_away",
  "description": "Marcus picks up his tools and walks toward the taxi."
}

{
  "type": "look_at_player",
  "description": "Marcus looks at the player briefly."
}

The action can be any realistic action appropriate
for the NPC and current situation.

NPC DATA:

Name:
${npc.name}

Age:
${npc.age}

Occupation:
${npc.occupation}

Description:
${npc.description}

Personality:
${JSON.stringify(npc.personality, null, 2)}

World knowledge:
${JSON.stringify(npc.world_knowledge, null, 2)}

Current state:
${JSON.stringify(npc.current_state, null, 2)}

Relationships:
${JSON.stringify(npc.relationships, null, 2)}

Behavior rules:
${JSON.stringify(npc.behavior_rules, null, 2)}

PREVIOUS MEMORIES:

${memoryText}

`;



    /* =====================================================
       SEND TO GEMINI
    ===================================================== */

    const result =
      await callGemini(
        systemInstruction,

        `The player is interacting with you now.

Player says:

"${message}"

Decide what ${npc.name} would realistically do.

Remember:
The NPC does NOT have to respond verbally.

Return only the required JSON structure.`
      );


    /* =====================================================
       NORMALIZE RESPONSE
    ===================================================== */

    const responseType =
      result.response_type ||
      "silence";

    const speech =
      result.speech ||
      "";

    const action =
      result.action ||
      null;

    const memory =
      result.memory ||
      null;


    /* =====================================================
       SAVE MEMORY
    ===================================================== */

    if (
      memory &&
      memory.importance >= 4
    ) {

      await supabase
        .from("fai_game_test_memory")
        .insert({

          npc_id: npcId,

          player_id: playerId,

          memory_type:
            "interaction",

          player_message:
            message,

          npc_response:
            speech || null,

          npc_action:
            action,

          importance:
            Math.min(
              Math.max(
                Number(
                  memory.importance
                ) || 5,
                1
              ),
              10
            )

        });

    }


    /* =====================================================
       RETURN TO FRONTEND
    ===================================================== */

    return res.json({

      success: true,

      npc: {

        id: npc.id,

        name: npc.name

      },

      response: {

        type:
          responseType,

        speech,

        action

      },

      memory: {

        saved:
          !!(
            memory &&
            memory.importance >= 4
          )

      }

    });


  } catch (error) {

    console.error(
      "❌ FAI Game NPC error:",
      error.message
    );

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "NPC simulation failed."

    });

  }

}