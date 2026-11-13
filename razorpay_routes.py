import os
import json
import time
import hmac
import hashlib
import urllib.parse
from pathlib import Path
from flask import request, jsonify, redirect

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
            # 1. Standard Order
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt_id,
                "payment_capture": 1,
                "notes": {
                    "pack_id": pack_id,
                    "credits": pack["credits"],
                    "days": str(pack["days"]),
                    "user_id": str(data.get("user_id") or ""),
                    "email": str(data.get("email") or ""),
                    "phone": str(data.get("phone") or ""),
                    "device_id": str(data.get("device_id") or "")
                }
            }
            rzp_order = rzp_client.order.create(data=order_data)

            # 2. Official Hosted Payment Link (rzp.io)
            # Completely bypasses all mobile iframe & Google Pay intent drop issues!
            payment_link_url = None
            try:
                callback_base = request.host_url.rstrip("/")
                proto = request.headers.get("X-Forwarded-Proto", "").lower()
                if proto == "https" or "onrender.com" in callback_base or request.is_secure:
                    if callback_base.startswith("http://"):
                        callback_base = "https://" + callback_base[7:]

                user_email = (data.get("email") or "").strip()
                user_name = (data.get("name") or "Creator").strip()
                user_phone = (data.get("phone") or "").replace("+91", "").replace(" ", "").strip()

                plink_data = {
                    "amount": amount_paise,
                    "currency": "INR",
                    "accept_partial": False,
                    "description": pack["title"],
                    "customer": {
                        "name": user_name or "Creator",
                        "email": user_email if "@" in user_email else "creator@hlocaptions.com"
                    },
                    "notify": {"sms": False, "email": False},
                    "reminder_enable": False,
                    "upi_link": True,
                    "notes": {
                        "pack_id": pack_id,
                        "device_id": str(data.get("device_id") or ""),
                        "email": user_email,
                        "name": user_name
                    },
                    "callback_url": f"{callback_base}/api/payment/callback",
                    "callback_method": "get"
                }
                if user_phone and len(user_phone) == 10:
                    plink_data["customer"]["contact"] = f"+91{user_phone}"

                plink = rzp_client.payment_link.create(plink_data)
                payment_link_url = plink.get("short_url")
            except Exception as pl_err:
                print("Payment link generation fallback notice:", pl_err)

            return jsonify({
                "ok": True,
                "order_id": rzp_order.get("id"),
                "amount": amount_paise,
                "currency": "INR",
                "key_id": RAZORPAY_KEY_ID,
                "pack": pack,
                "payment_url": payment_link_url
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
        user_email = (data.get("email") or "").strip().lower()
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
        import cloud_storage
        payments_file = (WORK.parent / "data") / "razorpay_payments.json"
        if not payments_file.exists() and cloud_storage.storage.is_enabled():
            try:
                cloud_storage.storage.download_file("razorpay_payments.json", payments_file)
            except Exception:
                pass
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
            payments_file.parent.mkdir(parents=True, exist_ok=True)
            payments_file.write_text(json.dumps(payments_data, indent=2), encoding="utf-8")
            if cloud_storage.storage.is_enabled():
                cloud_storage.storage.upload_file(payments_file, "razorpay_payments.json")
        except Exception:
            pass

        # Update device credits
        dev_file = (WORK.parent / "data") / "device_credits.json"
        if not dev_file.exists() and cloud_storage.storage.is_enabled():
            try:
                cloud_storage.storage.download_file("device_credits.json", dev_file)
            except Exception:
                pass
        dev_data = {}
        if dev_file.exists():
            try:
                dev_data = json.loads(dev_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        account_keys = list(dict.fromkeys([k for k in [device_id, user_email] if k]))
        target_key = account_keys[0] if account_keys else "guest"

        for key in account_keys:
            if key in dev_data:
                dev_data[key]["credits"] = dev_data[key].get("credits", 0) + credits_to_add
                dev_data[key]["has_paid"] = True
                if expires_at:
                    dev_data[key]["expires_at"] = expires_at
                if user_email:
                    dev_data[key]["email"] = user_email
                if user_name:
                    dev_data[key]["name"] = user_name
            else:
                dev_data[key] = {
                    "credits": credits_to_add,
                    "used": 0,
                    "has_paid": True,
                    "created_at": time.time(),
                    "email": user_email,
                    "name": user_name
                }
                if expires_at:
                    dev_data[key]["expires_at"] = expires_at

        try:
            dev_file.write_text(json.dumps(dev_data, indent=2), encoding="utf-8")
            if cloud_storage.storage.is_enabled():
                cloud_storage.storage.upload_file(dev_file, "device_credits.json")
        except Exception:
            pass

        if user_email:
            try:
                import re
                u_id = re.sub(r"\W", "_", user_email)
                u_dir = (WORK.parent / "data") / "users"
                u_dir.mkdir(parents=True, exist_ok=True)
                u_file = u_dir / f"{u_id}.json"
                if not u_file.exists() and cloud_storage.storage.is_enabled():
                    cloud_storage.storage.download_file(f"users/{u_id}.json", u_file)
                u_data = {}
                if u_file.exists():
                    try: u_data = json.loads(u_file.read_text(encoding="utf-8"))
                    except Exception: pass
                u_data["credits"] = dev_data.get(user_email, {}).get("credits", credits_to_add)
                u_data["email"] = user_email
                u_data["has_paid"] = True
                if user_name: u_data["name"] = user_name
                u_file.write_text(json.dumps(u_data, indent=2), encoding="utf-8")
                if cloud_storage.storage.is_enabled():
                    cloud_storage.storage.upload_file(u_file, f"users/{u_id}.json")
            except Exception:
                pass

        return jsonify({
            "ok": True,
            "message": f"Payment of ₹{pack['amount_inr']} successful! {credits_to_add} Video Exports added to your account.",
            "credits_added": credits_to_add,
            "total_credits": dev_data.get(target_key, {}).get("credits", credits_to_add),
            "payment_id": razorpay_payment_id
        })

    @app.route("/api/payment/callback", methods=["GET", "POST"])
    def payment_callback():
        """Handles browser-level redirect callback from Razorpay for 100% reliable mobile UPI intent & hosted checkout."""
        data = request.form if request.method == "POST" else request.args
        razorpay_payment_id = data.get("razorpay_payment_id")
        razorpay_order_id = data.get("razorpay_order_id")
        razorpay_payment_link_id = data.get("razorpay_payment_link_id")
        razorpay_signature = data.get("razorpay_signature")
        error_code = data.get("error[code]") or data.get("error_code")
        if error_code:
            err_desc = data.get("error[description]") or data.get("error_description") or "Payment was cancelled or could not be completed."
            return redirect(f"/?payment_error={urllib.parse.quote(err_desc)}")

        if not razorpay_payment_id:
            return redirect("/?payment_error=Missing+payment+id")

        pack_id = "pack10"
        device_id = ""
        user_email = ""
        user_name = ""
        payment_verified = False

        # Method 1: Fetch directly from Razorpay API (tamper-proof live check)
        if rzp_client:
            try:
                payment_info = rzp_client.payment.fetch(razorpay_payment_id)
                pay_status = payment_info.get("status")
                if pay_status == "authorized":
                    try:
                        rzp_client.payment.capture(razorpay_payment_id, payment_info.get("amount"))
                        pay_status = "captured"
                    except Exception as _cap_err:
                        print("Capture notice:", _cap_err)

                if pay_status == "captured":
                    payment_verified = True
                    notes = payment_info.get("notes") or {}
                    pack_id = notes.get("pack_id") or ("pack50" if payment_info.get("amount") == 5000 else "pack10")
                    device_id = notes.get("device_id") or ""
                    user_email = notes.get("email") or ""
                    user_name = notes.get("name") or notes.get("user_id") or ""
            except Exception as _fetch_err:
                print("Live payment fetch warning in callback:", _fetch_err)

        # Method 2: Cryptographic HMAC signature check (fallback validation)
        if not payment_verified and razorpay_signature:
            if razorpay_order_id:
                msg = f"{razorpay_order_id}|{razorpay_payment_id}"
                expected_sig = hmac.new(
                    RAZORPAY_KEY_SECRET.encode("utf-8"),
                    msg.encode("utf-8"),
                    hashlib.sha256
                ).hexdigest()
                if hmac.compare_digest(expected_sig, razorpay_signature):
                    payment_verified = True
            elif razorpay_payment_link_id:
                ref_id = data.get("razorpay_payment_link_reference_id") or ""
                pl_status = data.get("razorpay_payment_link_status") or "paid"
                msg = f"{razorpay_payment_link_id}|{ref_id}|{pl_status}|{razorpay_payment_id}"
                expected_sig = hmac.new(
                    RAZORPAY_KEY_SECRET.encode("utf-8"),
                    msg.encode("utf-8"),
                    hashlib.sha256
                ).hexdigest()
                if hmac.compare_digest(expected_sig, razorpay_signature):
                    payment_verified = True

        if not payment_verified:
            return redirect("/?payment_error=Payment+verification+failed")

        pack = PACKS.get(pack_id, PACKS["pack10"])
        credits_to_add = pack["credits"]
        valid_days = pack["days"]
        expires_at = (time.time() + valid_days * 86400) if valid_days else None

        # Record payment transaction
        try:
            import cloud_storage
            payments_file = (WORK.parent / "data") / "razorpay_payments.json"
            payments_data = []
            if payments_file.exists():
                try: payments_data = json.loads(payments_file.read_text(encoding="utf-8"))
                except Exception: pass

            payment_record = {
                "order_id": razorpay_order_id or razorpay_payment_link_id or "",
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
            payments_file.parent.mkdir(parents=True, exist_ok=True)
            payments_file.write_text(json.dumps(payments_data, indent=2), encoding="utf-8")
            if cloud_storage.storage.is_enabled():
                cloud_storage.storage.upload_file(payments_file, "razorpay_payments.json")
        except Exception as _rec_err:
            print("Payment record save error:", _rec_err)

        # Update device credits
        try:
            import cloud_storage
            dev_file = (WORK.parent / "data") / "device_credits.json"
            dev_data = {}
            if dev_file.exists():
                try: dev_data = json.loads(dev_file.read_text(encoding="utf-8"))
                except Exception: pass

            account_keys = list(dict.fromkeys([k for k in [device_id, user_email] if k]))
            for key in account_keys:
                if key in dev_data:
                    dev_data[key]["credits"] = dev_data[key].get("credits", 0) + credits_to_add
                    dev_data[key]["has_paid"] = True
                    if expires_at: dev_data[key]["expires_at"] = expires_at
                    if user_email: dev_data[key]["email"] = user_email
                    if user_name: dev_data[key]["name"] = user_name
                else:
                    dev_data[key] = {
                        "credits": credits_to_add,
                        "used": 0,
                        "has_paid": True,
                        "created_at": time.time(),
                        "email": user_email,
                        "name": user_name
                    }
                    if expires_at: dev_data[key]["expires_at"] = expires_at

            dev_file.write_text(json.dumps(dev_data, indent=2), encoding="utf-8")
            if cloud_storage.storage.is_enabled():
                cloud_storage.storage.upload_file(dev_file, "device_credits.json")

            if user_email:
                try:
                    import re
                    u_id = re.sub(r"\W", "_", user_email)
                    u_dir = (WORK.parent / "data") / "users"
                    u_dir.mkdir(parents=True, exist_ok=True)
                    u_file = u_dir / f"{u_id}.json"
                    u_data = {}
                    if u_file.exists():
                        try: u_data = json.loads(u_file.read_text(encoding="utf-8"))
                        except Exception: pass
                    u_data["credits"] = dev_data.get(user_email, {}).get("credits", credits_to_add)
                    u_data["email"] = user_email
                    u_data["has_paid"] = True
                    if user_name: u_data["name"] = user_name
                    u_file.write_text(json.dumps(u_data, indent=2), encoding="utf-8")
                    if cloud_storage.storage.is_enabled():
                        cloud_storage.storage.upload_file(u_file, f"users/{u_id}.json")
                except Exception:
                    pass
        except Exception as _dev_err:
            print("Device credits save error in callback:", _dev_err)

        return redirect(f"/?payment_success=true&credits={credits_to_add}&dev_id={urllib.parse.quote(device_id)}")
