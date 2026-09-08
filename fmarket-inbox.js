import "dotenv/config";

import {
  createClient
} from "@supabase/supabase-js";


const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );


/* =========================
   MAIN HANDLER
========================= */

export async function fmarketInbox(
  req,
  res
) {

  try {

    const {
      action,
      userId,
      lastEventAt,
      lastEventId
    } = req.body || {};


    /* =========================
       VALIDATION
    ========================= */

    if (!userId) {

      return res.status(400).json({
        success: false,
        error: "User ID is required."
      });

    }


    if (
      action !== "get_inbox"
    ) {

      return res.status(400).json({
        success: false,
        error: "Invalid action."
      });

    }


    /* =========================
       GET EVENTS
    ========================= */

    let query =
      supabase
        .from("fmarket_order_events")
        .select(`
          id,
          order_id,
          actor_id,
          event,
          description,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: true
          }
        )
        .limit(100);


    /*
      Only events involving this user.

      The user can be either:
      - buyer
      - seller
    */

    const {
      data: orders,
      error: ordersError
    } = await supabase
      .from("fmarket_orders")
      .select(
        "id,buyer_id,seller_id"
      )
      .or(
        `buyer_id.eq.${userId},seller_id.eq.${userId}`
      );


    if (ordersError) {

      return res.status(500).json({
        success: false,
        error:
          "Unable to load FMarket orders."
      });

    }


    const orderIds =
      (orders || []).map(
        order => order.id
      );


    /*
      No orders means no notifications.
    */

    if (!orderIds.length) {

      return res.json({
        success: true,
        notifications: [],
        last_event_id:
          lastEventId || null,
        last_event_at:
          lastEventAt || null
      });

    }


    query =
      query.in(
        "order_id",
        orderIds
      );


    /* =========================
       APPLY CHECKPOINT
    ========================= */

    if (lastEventAt) {

      query =
        query.gt(
          "created_at",
          lastEventAt
        );

    }


    const {
      data: events,
      error: eventsError
    } =
      await query;


    if (eventsError) {

      return res.status(500).json({
        success: false,
        error:
          "Unable to load FMarket notifications."
      });

    }


    /* =========================
       FILTER ACTOR
    ========================= */

    const notifications =
      (events || [])
        .filter(
          event =>
            event.actor_id !== userId
        )
        .map(
          event => {

            let title =
              "FMarket update";

            const eventName =
              String(
                event.event || ""
              ).toLowerCase();


            if (
              eventName ===
              "order_created"
            ) {

              title =
                "New FMarket order";

            } else if (
              eventName ===
              "order_accepted"
            ) {

              title =
                "Order accepted";

            } else if (
              eventName.includes(
                "delivery_fee"
              )
            ) {

              title =
                "Delivery fee update";

            } else if (
              eventName ===
              "order_ready"
            ) {

              title =
                "Order ready";

            } else if (
              eventName ===
              "order_handed_over"
            ) {

              title =
                "Order handed over";

            } else if (
              eventName ===
              "order_out_for_delivery"
            ) {

              title =
                "Order out for delivery";

            } else if (
              eventName ===
              "order_received"
            ) {

              title =
                "Order received";

            } else if (
              eventName ===
              "order_completed"
            ) {

              title =
                "Order completed";

            } else if (
              eventName ===
              "order_cancelled"
            ) {

              title =
                "Order cancelled";

            } else if (
              eventName ===
              "order_disputed"
            ) {

              title =
                "Order disputed";

            }


            return {
              id: event.id,

              order_id:
                event.order_id,

              type:
                event.event,

              title,

              message:
                event.description ||
                "There is an update on your FMarket order.",

              created_at:
                event.created_at
            };

          }
        );


    /* =========================
       NEW CHECKPOINT
    ========================= */

    let newLastEventId =
      lastEventId || null;

    let newLastEventAt =
      lastEventAt || null;


    if (notifications.length) {

      const latest =
        notifications[
          notifications.length - 1
        ];

      newLastEventId =
        latest.id;

      newLastEventAt =
        latest.created_at;


      /*
        Save the checkpoint.

        This is ONLY the user's
        inbox position.
      */

      const {
        error: stateError
      } = await supabase
        .from("fmarket_inbox_state")
        .upsert(
          {
            user_id: userId,
            last_event_id:
              newLastEventId,
            last_event_at:
              newLastEventAt,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              "user_id"
          }
        );


      if (stateError) {

        return res.status(500).json({
          success: false,
          error:
            "Unable to save inbox state."
        });

      }

    }


    /* =========================
       RESPONSE
    ========================= */

    return res.json({
      success: true,

      notifications,

      last_event_id:
        newLastEventId,

      last_event_at:
        newLastEventAt
    });


  } catch (error) {

    return res.status(500).json({
      success: false,
      error:
        "FMarket inbox server error."
    });

  }

}