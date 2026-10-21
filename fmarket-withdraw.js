import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

async function paystackRequest(path, options = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(
      data.message || `Paystack API returned HTTP ${response.status}.`
    );
  }

  return data.data;
}

export default async function fmarketWithdraw(req, res) {
  try {
    const configuredAdminKey =
      process.env.FMARKET_WITHDRAW_ADMIN_KEY;

    if (!configuredAdminKey) {
      return res.status(500).json({
        success: false,
        error: "Admin withdrawal key is not configured."
      });
    }

    const suppliedAdminKey =
      req.get("X-Admin-Withdraw-Key");

    if (
      !suppliedAdminKey ||
      suppliedAdminKey.length !== configuredAdminKey.length ||
      !crypto.timingSafeEqual(
        Buffer.from(suppliedAdminKey),
        Buffer.from(configuredAdminKey)
      )
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized withdrawal request."
      });
    }

    const {
      accountName,
      accountNumber,
      bankCode,
      amountNaira
    } = req.body || {};

    if (
      typeof accountName !== "string" ||
      !accountName.trim() ||
      typeof accountNumber !== "string" ||
      !/^\d{10}$/.test(accountNumber) ||
      typeof bankCode !== "string" ||
      !/^\d+$/.test(bankCode) ||
      !Number.isSafeInteger(amountNaira) ||
      amountNaira < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid account details or withdrawal amount."
      });
    }

    const amountKobo = amountNaira * 100;

    if (!Number.isSafeInteger(amountKobo)) {
      return res.status(400).json({
        success: false,
        error: "Withdrawal amount is too large."
      });
    }

    // Step 1: Resolve the bank account with Paystack.
    const resolvedAccount = await paystackRequest(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
    );

    const verifiedAccountName =
      resolvedAccount.account_name;

    if (
      !verifiedAccountName ||
      verifiedAccountName.trim().toLowerCase() !==
        accountName.trim().toLowerCase()
    ) {
      return res.status(400).json({
        success: false,
        error: "The supplied account name does not match Paystack's account name.",
        verifiedAccountName
      });
    }

    // Step 2: Create a bank transfer recipient.
    const recipient = await paystackRequest(
      "/transferrecipient",
      {
        method: "POST",
        body: JSON.stringify({
          type: "nuban",
          name: verifiedAccountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN"
        })
      }
    );

    if (!recipient.recipient_code) {
      throw new Error("Paystack did not return a recipient code.");
    }

    // Step 3: Initiate the transfer.
    const reference = `fmw_${crypto.randomUUID()}`;

    const transfer = await paystackRequest(
      "/transfer",
      {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: amountKobo,
          recipient: recipient.recipient_code,
          reference,
          reason: "FMarket admin withdrawal test",
          currency: "NGN"
        })
      }
    );

    return res.status(200).json({
      success: true,
      message: "Paystack returned a transfer response. Check its status before treating the money as received.",
      reference: transfer.reference || reference,
      transferStatus: transfer.status,
      transferCode: transfer.transfer_code || null,
      amountNaira,
      currency: "NGN",
      verifiedAccountName,
      recipientCode: recipient.recipient_code
    });

  } catch (error) {
    console.error(
      "[FMARKET WITHDRAW]",
      error.message
    );

    return res.status(400).json({
      success: false,
      error: error.message || "Withdrawal failed."
    });
  }
}