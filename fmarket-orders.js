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
  pickup_location,
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
           .select("id, username, full_name")
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
  buyer.full_name ||
  buyer.username ||
  "Buyer"
                  }
                : null,

              seller: seller
                ? {
                    id: seller.id,
                    name:
  seller.full_name ||
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
   SET DELIVERY DETAILS
========================= */

if (
  action === "set_delivery"
) {

  const {
    deliveryMethod,
    deliveryLocation
  } =
    req.body || {};


  if (
    ![
      "pickup",
      "delivery"
    ].includes(
      deliveryMethod
    )
  ) {

    return res.status(400).json({

      success: false,

      error:
        "Invalid delivery method."

    });

  }


  const {
    data: order,
    error: orderError
  } =
    await supabase
      .from("fmarket_orders")
      .select("*")
      .eq(
        "id",
        orderId
      )
      .single();


  if (orderError) {
    throw orderError;
  }


  /* =========================
     BUYER ONLY
  ========================= */

  if (
    order.buyer_id !== userId
  ) {

    return res.status(403).json({

      success: false,

      error:
        "Only the buyer can set delivery details."

    });

  }


  /* =========================
     ORDER MUST BE EDITABLE
  ========================= */

  if (
    [
      "ready",
      "out_for_delivery",
      "handed_over",
      "received",
      "completed"
    ].includes(
      order.status
    )
  ) {

    return res.status(400).json({

      success: false,

      error:
        "Delivery details can no longer be changed because fulfillment has started."

    });

  }


  /*
     Once a delivery fee has been
     accepted, the agreement is locked.
  */

  if (
    order.delivery_method ===
      "delivery" &&
    order.delivery_fee_status ===
      "accepted"
  ) {

    return res.status(400).json({

      success: false,

      error:
        "Delivery details can no longer be changed because the delivery arrangement has been accepted."

    });

  }


  /* =========================
     PICKUP
  ========================= */

  if (
    deliveryMethod ===
    "pickup"
  ) {

    const {
      data: material,
      error: materialError
    } =
      await supabase
        .from("fmarket")
        .select(
          "pickup_location"
        )
        .eq(
          "id",
          order.material_id
        )
        .single();


    if (materialError) {
      throw materialError;
    }


    if (
      !material?.pickup_location
    ) {

      return res.status(400).json({

        success: false,

        error:
          "The seller has not provided a pickup location."

      });

    }

  }


  /* =========================
     DELIVERY
  ========================= */

  let cleanLocation = null;


  if (
    deliveryMethod ===
    "delivery"
  ) {

    if (
      !deliveryLocation ||
      !String(
        deliveryLocation
      ).trim()
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Delivery location is required."

      });

    }


    cleanLocation =
      String(
        deliveryLocation
      ).trim();


    if (
      cleanLocation.length > 300
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Delivery location is too long."

      });

    }

  }


  /* =========================
     DELIVERY FEE STATE
  ========================= */

  let deliveryFeeStatus =
    "not_required";


  let deliveryFee =
    0;


  if (
    deliveryMethod ===
    "delivery"
  ) {

    /*
       If buyer changes their
       delivery location before
       fee acceptance, the seller
       must quote again.
    */

    deliveryFeeStatus =
      "pending";

    deliveryFee =
      0;

  }


  /* =========================
     UPDATE ORDER
  ========================= */

  const {
    data: updated,
    error: updateError
  } =
    await supabase
      .from("fmarket_orders")
      .update({

        delivery_method:
          deliveryMethod,

        delivery_location:
          cleanLocation,

        delivery_fee:
          deliveryFee,

        delivery_fee_status:
          deliveryFeeStatus,

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


  /* =========================
     EVENT
  ========================= */

  const description =
    deliveryMethod === "pickup"
      ? "Buyer selected pickup."
      : "Buyer selected delivery and provided a delivery location.";


  await supabase
    .from("fmarket_order_events")
    .insert({

      order_id:
        orderId,

      actor_id:
        userId,

      event:
        "delivery_details_updated",

      description

    });


  return res.json({

    success: true,

    message:
      deliveryMethod === "pickup"
        ? "Pickup details saved."
        : "Delivery location saved. The seller must now set the delivery fee.",

    order:
      updated

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


/* =========================
   READY VALIDATION
========================= */

if (
  newStatus === "ready"
) {

  /* =========================
     METHOD REQUIRED
  ========================= */

  if (
    !order.delivery_method
  ) {

    return res.status(400).json({

      success: false,

      error:
        "The buyer must choose pickup or delivery first."

    });

  }


  /* =========================
     PICKUP
  ========================= */

  if (
    order.delivery_method ===
    "pickup"
  ) {

    if (
      !order.material_id
    ) {

      return res.status(400).json({

        success: false,

        error:
          "This order has no material attached."

      });

    }

    /*
       Pickup requires no buyer
       delivery address.
    */

  }


  /* =========================
     DELIVERY
  ========================= */

  if (
    order.delivery_method ===
    "delivery"
  ) {

    if (
      !order.delivery_location
    ) {

      return res.status(400).json({

        success: false,

        error:
          "The buyer must provide a delivery location."

      });

    }


    if (
      order.delivery_fee_status !==
      "accepted"
    ) {

      return res.status(400).json({

        success: false,

        error:
          "The delivery fee must be accepted by the buyer before the order can be marked ready."

      });

    }

  }

}


/* =========================
   ALLOWED TRANSITIONS
========================= */

const allowedTransitions = {

  accepted: [
    "pending"
  ],

  ready: [
    "accepted"
  ],

  out_for_delivery: [
    "ready"
  ],

  handed_over: [
    "ready",
    "out_for_delivery"
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

  try {

    const {
      data,
      error
    } =
      await supabase.rpc(
        "complete_fmarket_order",
        {
          p_user_id:
            userId,

          p_order_id:
            orderId
        }
      );


    if (error) {
      throw error;
    }


    if (
      !data ||
      !data.success
    ) {

      return res.status(400).json({

        success: false,

        error:
          data?.error ||
          "Unable to complete order."

      });

    }


    return res.json({

      success: true,

      message:
        data.message ||
        "Order completed and payment released.",

      order_id:
        data.order_id,

      released:
        data.released,

      seller_fcoins:
        data.seller_fcoins

    });

  } catch (error) {

    console.error(
      "❌ FMarket received error:",
      error.message
    );

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to complete order."

    });

  }

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
    data,
    error
  } =
    await supabase.rpc(
      "cancel_fmarket_order",
      {
        p_user_id: userId,
        p_order_id: orderId
      }
    );


  if (error) {
    throw error;
  }


  if (
    !data ||
    !data.success
  ) {

    return res.status(400).json({

      success: false,

      error:
        data?.error ||
        "Unable to cancel order."

    });

  }


  return res.json({

    success: true,

    message:
      data.message ||
      "Order cancelled and FCoins refunded.",

    order_id:
      data.order_id,

    refund:
      data.refund,

    fcoins:
      data.fcoins

  });

}