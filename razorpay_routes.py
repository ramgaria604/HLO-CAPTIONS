import os
import json
import time
import hmac
import hashlib
from pathlib import Path
from flask import request, jsonify

# Razorpay credentials (can be set via env vars or default fallback)
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_live_TqqwYG8BtQ1lSZ")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "JSGjwLe03beKLM5w7yN1wNQB")

PACKS = {
    "pack10": {
        "amount_inr": 10,
        "amount_paise": 1000,
        "credits": 1,
        "days": None,
        "title": "₹10 Instant Single Export Pass",
        "description": "1 Video Export (1080p Ultra HD)"
    },
    "pack50": {
        "amount_inr": 50,
        "amount_paise": 5000,
        "credits": 7,
        "days": 7,
        "title": "₹50 Weekly Creator Pack",
        "description": "7 Video Exports (Valid for 7 Days)"
    }
}

def register_razorpay_routes(app, WORK):
    try:
        import razorpay
        rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as e:
        rzp_client = None

    @app.get("/api/payment/config")
    def get_payment_config():
        """Returns public Razorpay Key ID and available packs."""
        return jsonify({
            "key_id": RAZORPAY_KEY_ID,
            "packs": {k: {"amount": v["amount_inr"], "credits": v["credits"], "days": v["days"], "title": v["title"]} for k, v in PACKS.items()}
        })

    @app.post("/api/payment/create-order")
    def create_order():
        """Creates an official Razorpay Order ID for ₹10 or ₹50 pack."""
        data = request.get_json(force=True) or {}
        pack_id = data.get("pack_id", "pack10")
        if pack_id not in PACKS:
            return jsonify(ok=False, error="Invalid pack selected"), 400

        pack = PACKS[pack_id]
        amount_paise = pack["amount_paise"]
        receipt_id = f"rcpt_{int(time.time())}_{pack_id}"

        if not rzp_client:
            return jsonify(ok=False, error="Razorpay SDK not initialized on server"), 500

        try:
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt_id,
                "notes": {
                    "pack_id": pack_id,
                    "credits": pack["credits"],
                    "days": str(pack["days"]),
                    "user_id": str(data.get("user_id") or ""),
                    "email": str(data.get("email") or ""),
                    "device_id": str(data.get("device_id") or "")
                }
            }
            rzp_order = rzp_client.order.create(data=order_data)
            return jsonify({
                "ok": True,
                "order_id": rzp_order.get("id"),
                "amount": amount_paise,
                "currency": "INR",
                "key_id": RAZORPAY_KEY_ID,
                "pack": pack
            })
        except Exception as e:
            return jsonify(ok=False, error=f"Razorpay order creation failed: {str(e)}"), 500

    @app.post("/api/payment/verify")
    def verify_payment():
        """Verifies Razorpay payment signature and credits the user account."""
        data = request.get_json(force=True) or {}
        razorpay_order_id = data.get("razorpay_order_id")
        razorpay_payment_id = data.get("razorpay_payment_id")
        razorpay_signature = data.get("razorpay_signature")
        pack_id = data.get("pack_id", "pack10")
        device_id = (data.get("device_id") or "").strip()
        user_email = (data.get("email") or "").strip()
        user_name = (data.get("name") or "").strip()

        if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
            return jsonify(ok=False, error="Missing payment verification parameters"), 400

        # Cryptographic signature verification using HMAC-SHA256
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_sig = hmac.new(
            RAZORPAY_KEY_SECRET.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, razorpay_signature):
            return jsonify(ok=False, error="Invalid payment signature! Payment cannot be verified."), 400

        # Payment is verified authentic!
        pack = PACKS.get(pack_id, PACKS["pack10"])
        credits_to_add = pack["credits"]
        valid_days = pack["days"]
        expires_at = (time.time() + valid_days * 86400) if valid_days else None

        # Record payment transaction
        payments_file = (WORK.parent / "data") / "razorpay_payments.json"
        payments_data = []
        if payments_file.exists():
            try:
                payments_data = json.loads(payments_file.read_text(encoding="utf-8"))
            except Exception:
                payments_data = []

        payment_record = {
            "order_id": razorpay_order_id,
            "payment_id": razorpay_payment_id,
            "pack_id": pack_id,
            "amount_inr": pack["amount_inr"],
            "credits": credits_to_add,
            "device_id": device_id,
            "email": user_email,
            "name": user_name,
            "timestamp": time.time(),
            "date": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        payments_data.append(payment_record)
        try:
            payments_file.write_text(json.dumps(payments_data, indent=2), encoding="utf-8")
        except Exception:
            pass

        # Update device credits
        dev_file = (WORK.parent / "data") / "device_credits.json"
        dev_data = {}
        if dev_file.exists():
            try:
                dev_data = json.loads(dev_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        account_keys = [k for k in [device_id, user_email] if k]
        target_key = account_keys[0] if account_keys else "guest"

        for key in account_keys:
            if key in dev_data:
                dev_data[key]["credits"] = dev_data[key].get("credits", 0) + credits_to_add
                if expires_at:
                    dev_data[key]["expires_at"] = expires_at
                if user_email:
                    dev_data[key]["email"] = user_email
                if user_name:
                    dev_data[key]["name"] = user_name
            else:
                dev_data[key] = {
                    "credits": credits_to_add,
                    "used": 1,
                    "created_at": time.time(),
                    "email": user_email,
                    "name": user_name
                }
                if expires_at:
                    dev_data[key]["expires_at"] = expires_at

        try:
            dev_file.write_text(json.dumps(dev_data, indent=2), encoding="utf-8")
        except Exception:
            pass

        return jsonify({
            "ok": True,
            "message": f"Payment of ₹{pack['amount_inr']} successful! {credits_to_add} Video Exports added to your account.",
            "credits_added": credits_to_add,
            "total_credits": dev_data.get(target_key, {}).get("credits", credits_to_add),
            "payment_id": razorpay_payment_id
        })
