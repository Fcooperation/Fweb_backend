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

export async function fmarketOrders(
  req,
  res
) {

  try {

    const {
      action,
      userId,
      orderId
    } =
      req.body || {};


    if (!userId) {

      return res.status(400).json({
        success: false,
        error: "User ID is required."
      });

    }


    /* =========================
       GET ORDERS
    ========================= */

    if (
      action === "get_orders"
    ) {

      const {
        data,
        error
      } =
        await supabase
          .from("fmarket_orders")
          .select(`
            *,
            material:fmarket(
              id,
              title,
              description,
              category,
              course,
              university,
              material_type,
              price,
              location,
              condition,
              image_url
            )
          `)
          .or(
            `buyer_id.eq.${userId},seller_id.eq.${userId}`
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );


      if (error) {
        throw error;
      }


      const orders =
        data || [];


      const buyerIds =
        [
          ...new Set(
            orders.map(
              order =>
                order.buyer_id
            )
          )
        ];


      const sellerIds =
        [
          ...new Set(
            orders.map(
              order =>
                order.seller_id
            )
          )
        ];


      const allUserIds =
        [
          ...new Set([
            ...buyerIds,
            ...sellerIds
          ])
        ];


      let users = [];


      if (
        allUserIds.length
      ) {

        const {
          data: userData,
          error: userError
        } =
          await supabase
            .from("fwebaccount")
            .select(
              "id, username, name"
            )
            .in(
              "id",
              allUserIds
            );


        if (userError) {
          throw userError;
        }


        users =
          userData || [];

      }


      const userMap =
        new Map();


      users.forEach(
        user => {

          userMap.set(
            user.id,
            user
          );

        }
      );


      const formatted =
        orders.map(
          order => {

            const buyer =
              userMap.get(
                order.buyer_id
              );

            const seller =
              userMap.get(
                order.seller_id
              );


            return {

              ...order,

              buyer: buyer
                ? {
                    id: buyer.id,
                    name:
                      buyer.name ||
                      buyer.username ||
                      "Buyer"
                  }
                : null,

              seller: seller
                ? {
                    id: seller.id,
                    name:
                      seller.name ||
                      seller.username ||
                      "Seller"
                  }
                : null

            };

          }
        );


      return res.json({

        success: true,

        buying:
          formatted.filter(
            order =>
              order.buyer_id ===
              userId
          ),

        selling:
          formatted.filter(
            order =>
              order.seller_id ===
              userId
          )

      });

    }


    /* =========================
       ORDER ACTIONS
    ========================= */

    if (!orderId) {

      return res.status(400).json({
        success: false,
        error: "Order ID is required."
      });

    }


    if (
      action === "accept"
    ) {

      return updateOrderStatus(
        res,
        userId,
        orderId,
        "accepted",
        "seller_accepted"
      );

    }


    if (
      action === "ready"
    ) {

      return updateOrderStatus(
        res,
        userId,
        orderId,
        "ready",
        "seller_marked_ready"
      );

    }


    if (
      action === "handed_over"
    ) {

      return updateOrderStatus(
        res,
        userId,
        orderId,
        "handed_over",
        "seller_handed_over"
      );

    }


    if (
      action === "received"
    ) {

      return handleReceived(
        res,
        userId,
        orderId
      );

    }


    if (
      action === "cancel"
    ) {

      return handleCancel(
        res,
        userId,
        orderId
      );

    }


    return res.status(400).json({

      success: false,

      error:
        "Invalid action."

    });


  } catch (error) {

    console.error(
      "❌ FMarket orders error:",
      error.message
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to process order."

    });

  }

}


/* =========================
   UPDATE STATUS
========================= */

async function updateOrderStatus(
  res,
  userId,
  orderId,
  newStatus,
  event
) {

  const {
    data: order,
    error: orderError
  } =
    await supabase
      .from("fmarket_orders")
      .select("*")
      .eq("id", orderId)
      .single();


  if (orderError) {
    throw orderError;
  }


  /* =========================
     SELLER ONLY
  ========================= */

  if (
    order.seller_id !== userId
  ) {

    return res.status(403).json({

      success: false,

      error:
        "Only the seller can perform this action."

    });

  }


  const allowedTransitions = {

    accepted: [
      "pending"
    ],

    ready: [
      "accepted"
    ],

    handed_over: [
      "ready"
    ]

  };


  if (
    !allowedTransitions[
      newStatus
    ]?.includes(
      order.status
    )
  ) {

    return res.status(400).json({

      success: false,

      error:
        `Order cannot be changed from ${order.status} to ${newStatus}.`

    });

  }


  const {
    data: updated,
    error: updateError
  } =
    await supabase
      .from("fmarket_orders")
      .update({
        status: newStatus,
        updated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        orderId
      )
      .select()
      .single();


  if (updateError) {
    throw updateError;
  }


  await supabase
    .from("fmarket_order_events")
    .insert({

      order_id:
        orderId,

      actor_id:
        userId,

      event,

      description:
        `Order changed to ${newStatus}.`

    });


  return res.json({

    success: true,

    message:
      `Order is now ${newStatus}.`,

    order:
      updated

  });

}


/* =========================
   RECEIVED
========================= */

async function handleReceived(
  res,
  userId,
  orderId
) {

  const {
    data: order,
    error
  } =
    await supabase
      .from("fmarket_orders")
      .select("*")
      .eq("id", orderId)
      .single();


  if (error) {
    throw error;
  }


  if (
    order.buyer_id !== userId
  ) {

    return res.status(403).json({

      success: false,

      error:
        "Only the buyer can confirm receipt."

    });

  }


  if (
    order.status !==
    "handed_over"
  ) {

    return res.status(400).json({

      success: false,

      error:
        "This order is not ready to be confirmed."

    });

  }


  /*
   * IMPORTANT:
   *
   * Do NOT release the seller's
   * FCoins directly from here.
   *
   * This should eventually call
   * a secure Supabase RPC that:
   *
   * 1. Locks the order
   * 2. Checks payment is held
   * 3. Changes payment to released
   * 4. Credits seller
   * 5. Marks order completed
   *
   * We will add that RPC separately.
   */


  const {
    data: updated,
    error: updateError
  } =
    await supabase
      .from("fmarket_orders")
      .update({

        status:
          "received",

        updated_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        orderId
      )
      .select()
      .single();


  if (updateError) {
    throw updateError;
  }


  await supabase
    .from("fmarket_order_events")
    .insert({

      order_id:
        orderId,

      actor_id:
        userId,

      event:
        "buyer_confirmed_received",

      description:
        "Buyer confirmed that the textbook was received."

    });


  return res.json({

    success: true,

    message:
      "Receipt confirmed. Payment is awaiting release.",

    order:
      updated

  });

}


/* =========================
   CANCEL
========================= */

async function handleCancel(
  res,
  userId,
  orderId
) {

  const {
    data: order,
    error
  } =
    await supabase
      .from("fmarket_orders")
      .select("*")
      .eq("id", orderId)
      .single();


  if (error) {
    throw error;
  }


  if (
    order.buyer_id !== userId &&
    order.seller_id !== userId
  ) {

    return res.status(403).json({

      success: false,

      error:
        "You are not part of this order."

    });

  }


  if (
    ![
      "pending",
      "accepted"
    ].includes(
      order.status
    )
  ) {

    return res.status(400).json({

      success: false,

      error:
        "This order can no longer be cancelled."

    });

  }


  const {
    data: updated,
    error: updateError
  } =
    await supabase
      .from("fmarket_orders")
      .update({

        status:
          "cancelled",

        updated_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        orderId
      )
      .select()
      .single();


  if (updateError) {
    throw updateError;
  }


  /*
   * IMPORTANT:
   *
   * The held FCoins should be refunded
   * through a secure database RPC.
   *
   * Do not manually modify fwebaccount
   * from the frontend.
   */


  await supabase
    .from("fmarket_order_events")
    .insert({

      order_id:
        orderId,

      actor_id:
        userId,

      event:
        "order_cancelled",

      description:
        "Physical textbook order was cancelled."

    });


  return res.json({

    success: true,

    message:
      "Order cancelled.",

    order:
      updated

  });

}