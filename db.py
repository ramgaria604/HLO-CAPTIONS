import os
import json
import time
import re
from pathlib import Path
from contextlib import contextmanager

BASE = Path(__file__).resolve().parent
DATA_DIR = BASE / "data"
USERS_DIR = DATA_DIR / "users"
WORK = BASE / "work"

try:
    import psycopg2
    from psycopg2 import pool
    from psycopg2.extras import RealDictCursor, Json
    HAS_PG = True
except ImportError:
    HAS_PG = False

_db_pool = None
_db_initialized = False

DEFAULT_COUPONS = {
    # Creator & Owner Codes (Unlimited 100 Credits)
    "NIKHILNOTTA1": {"credits": 100, "unlimited": True},
    "NIKHIL604": {"credits": 100, "unlimited": True},
    "PRO100": {"credits": 100, "unlimited": True},
    # Checkout Discount Coupons
    "KEIX 15": {"discount": True, "discount_pack10": 5, "discount_pack50": 10},
    "KEIX15": {"discount": True, "discount_pack10": 5, "discount_pack50": 10},
    "FAIZAN 30": {"discount": True, "discount_pack10": 5, "discount_pack50": 10},
    "FAIZAN30": {"discount": True, "discount_pack10": 5, "discount_pack50": 10},
    # 10 Exclusive Single-Use Codes (max 1 use total each, 2 free credits each)
    "VAULT4A": {"credits": 2, "max_uses": 1},
    "ZINE9K": {"credits": 2, "max_uses": 1},
    "HUD3M8": {"credits": 2, "max_uses": 1},
    "MINT6P": {"credits": 2, "max_uses": 1},
    "APEX2R": {"credits": 2, "max_uses": 1},
    "CLIP7W": {"credits": 2, "max_uses": 1},
    "NEON5D": {"credits": 2, "max_uses": 1},
    "GOLD8N": {"credits": 2, "max_uses": 1},
    "FRAME3T": {"credits": 2, "max_uses": 1},
    "SPARK9J": {"credits": 2, "max_uses": 1},
}


def get_database_url():
    url = os.environ.get("DATABASE_URL", "").strip()
    if url and url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def is_db_enabled():
    return bool(HAS_PG and get_database_url())


def get_pool():
    global _db_pool
    if not is_db_enabled():
        return None
    if _db_pool is None:
        url = get_database_url()
        try:
            _db_pool = psycopg2.pool.ThreadedConnectionPool(1, 10, url)
        except Exception as e:
            print("[DB] Failed to create connection pool:", e)
            _db_pool = None
    return _db_pool


@contextmanager
def get_db():
    p = get_pool()
    if p is None:
        yield None
        return
    conn = p.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


def init_db():
    global _db_initialized
    if _db_initialized or not is_db_enabled():
        return
    try:
        with get_db() as conn:
            if not conn:
                return
            with conn.cursor() as cur:
                # 1. Device credits table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS device_credits (
                    id VARCHAR(255) PRIMARY KEY,
                    email VARCHAR(255),
                    name VARCHAR(255),
                    credits INTEGER DEFAULT 0,
                    used INTEGER DEFAULT 0,
                    has_paid BOOLEAN DEFAULT FALSE,
                    expires_at DOUBLE PRECISION,
                    created_at DOUBLE PRECISION,
                    last_export DOUBLE PRECISION,
                    last_check DOUBLE PRECISION,
                    data JSONB
                );
                CREATE INDEX IF NOT EXISTS idx_dev_email ON device_credits(email);
                """)

                # 2. User credits table (Gmail linked)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS user_credits (
                    user_id VARCHAR(255) PRIMARY KEY,
                    email VARCHAR(255) UNIQUE,
                    name VARCHAR(255),
                    credits INTEGER DEFAULT 0,
                    used INTEGER DEFAULT 0,
                    has_paid BOOLEAN DEFAULT FALSE,
                    expires_at DOUBLE PRECISION,
                    created_at DOUBLE PRECISION,
                    last_login DOUBLE PRECISION,
                    picture TEXT,
                    data JSONB
                );
                CREATE INDEX IF NOT EXISTS idx_user_email ON user_credits(email);
                """)

                # 3. Razorpay payments table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS payments (
                    order_id VARCHAR(255) PRIMARY KEY,
                    payment_id VARCHAR(255),
                    pack_id VARCHAR(100),
                    amount_inr INTEGER,
                    credits INTEGER,
                    device_id VARCHAR(255),
                    email VARCHAR(255),
                    name VARCHAR(255),
                    timestamp DOUBLE PRECISION,
                    date_str VARCHAR(100),
                    data JSONB
                );
                """)

                # 4. Redeemed coupons table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS redeemed_coupons (
                    key VARCHAR(255) PRIMARY KEY,
                    code VARCHAR(100),
                    user_id VARCHAR(255),
                    device_id VARCHAR(255),
                    email VARCHAR(255),
                    timestamp DOUBLE PRECISION,
                    data JSONB
                );
                CREATE INDEX IF NOT EXISTS idx_redeem_code ON redeemed_coupons(code);
                """)

                # 5. Coupons table
                cur.execute("""
                CREATE TABLE IF NOT EXISTS coupons (
                    code VARCHAR(100) PRIMARY KEY,
                    credits INTEGER DEFAULT 0,
                    max_uses INTEGER,
                    unlimited BOOLEAN DEFAULT FALSE,
                    days INTEGER,
                    data JSONB
                );
                """)

                # 6. Export events table (guarantees exactly 1 credit deduction per export)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS export_events (
                    export_id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255),
                    email VARCHAR(255),
                    device_id VARCHAR(255),
                    credits_deducted INTEGER DEFAULT 1,
                    created_at DOUBLE PRECISION
                );
                """)

                # Seed default coupons
                for code, info in DEFAULT_COUPONS.items():
                    cur.execute("""
                    INSERT INTO coupons (code, credits, max_uses, unlimited, days, data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (code) DO NOTHING;
                    """, (code, info.get("credits", 0), info.get("max_uses"), bool(info.get("unlimited")), info.get("days"), Json(info)))

                # One-time import from existing JSON files if tables are empty
                cur.execute("SELECT count(*) FROM user_credits;")
                user_count = cur.fetchone()[0]
                if user_count == 0:
                    _one_time_import_json(cur)

        _db_initialized = True
        print("[DB] PostgreSQL initialized successfully with all tables and seeds.")
    except Exception as e:
        print("[DB] Failed to initialize PostgreSQL tables:", e)


def _one_time_import_json(cur):
    print("[DB] Running one-time migration from local JSON files to PostgreSQL...")
    # Import device_credits.json
    dev_file = DATA_DIR / "device_credits.json"
    if dev_file.exists():
        try:
            d_data = json.loads(dev_file.read_text(encoding="utf-8"))
            for k, v in d_data.items():
                if isinstance(v, dict):
                    cur.execute("""
                    INSERT INTO device_credits (id, email, name, credits, used, has_paid, expires_at, created_at, last_export, data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                    """, (
                        k,
                        v.get("email"),
                        v.get("name"),
                        v.get("credits", 0),
                        v.get("used", 0),
                        bool(v.get("has_paid")),
                        v.get("expires_at"),
                        v.get("created_at"),
                        v.get("last_export"),
                        Json(v)
                    ))
        except Exception as e:
            print("[DB] Notice importing device_credits.json:", e)

    # Import users/*.json
    if USERS_DIR.exists():
        for ufile in USERS_DIR.glob("*.json"):
            try:
                udata = json.loads(ufile.read_text(encoding="utf-8"))
                uid = udata.get("id") or ufile.stem
                cur.execute("""
                INSERT INTO user_credits (user_id, email, name, credits, used, has_paid, expires_at, created_at, last_login, picture, data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO NOTHING;
                """, (
                    uid,
                    udata.get("email"),
                    udata.get("name"),
                    udata.get("credits", 0),
                    udata.get("used", 0),
                    bool(udata.get("has_paid")),
                    udata.get("expires_at"),
                    udata.get("created_at"),
                    udata.get("last_login"),
                    udata.get("picture"),
                    Json(udata)
                ))
            except Exception as e:
                print("[DB] Notice importing user file:", e)

    # Import razorpay_payments.json
    pay_file = DATA_DIR / "razorpay_payments.json"
    if pay_file.exists():
        try:
            p_data = json.loads(pay_file.read_text(encoding="utf-8"))
            if isinstance(p_data, list):
                for p in p_data:
                    oid = p.get("order_id") or p.get("payment_id") or f"pay_{time.time()}"
                    cur.execute("""
                    INSERT INTO payments (order_id, payment_id, pack_id, amount_inr, credits, device_id, email, name, timestamp, date_str, data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (order_id) DO NOTHING;
                    """, (
                        oid,
                        p.get("payment_id"),
                        p.get("pack_id"),
                        p.get("amount_inr"),
                        p.get("credits"),
                        p.get("device_id"),
                        p.get("email"),
                        p.get("name"),
                        p.get("timestamp"),
                        p.get("date"),
                        Json(p)
                    ))
        except Exception as e:
            print("[DB] Notice importing razorpay_payments.json:", e)

    # Import redeemed_coupons.json
    for rpath in (DATA_DIR / "redeemed_coupons.json", WORK / "redeemed_coupons.json"):
        if rpath.exists():
            try:
                r_data = json.loads(rpath.read_text(encoding="utf-8"))
                for rk, rv in r_data.items():
                    if isinstance(rv, dict):
                        cur.execute("""
                        INSERT INTO redeemed_coupons (key, code, user_id, device_id, email, timestamp, data)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (key) DO NOTHING;
                        """, (
                            rk,
                            rv.get("code"),
                            rv.get("user_id"),
                            rv.get("device_id"),
                            rv.get("email"),
                            rv.get("ts"),
                            Json(rv)
                        ))
            except Exception as e:
                print("[DB] Notice importing redeemed_coupons.json:", e)


# ====================================================================
# DB ACCESS HELPERS
# ====================================================================

def db_load_device_credits_data():
    if not is_db_enabled():
        return None
    try:
        init_db()
        with get_db() as conn:
            if not conn: return None
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM device_credits;")
                rows = cur.fetchall()
                out = {}
                for r in rows:
                    rec = dict(r.get("data") or {})
                    rec.update({
                        "email": r.get("email"),
                        "name": r.get("name"),
                        "credits": r.get("credits", 0),
                        "used": r.get("used", 0),
                        "has_paid": bool(r.get("has_paid")),
                        "expires_at": r.get("expires_at"),
                        "created_at": r.get("created_at"),
                        "last_export": r.get("last_export"),
                    })
                    out[r["id"]] = rec
                return out
    except Exception as e:
        print("[DB] Error loading device credits:", e)
        return None


def db_save_device_credits_data(dev_data):
    if not is_db_enabled() or not isinstance(dev_data, dict):
        return False
    try:
        init_db()
        with get_db() as conn:
            if not conn: return False
            with conn.cursor() as cur:
                for k, v in dev_data.items():
                    if isinstance(v, dict):
                        cur.execute("""
                        INSERT INTO device_credits (id, email, name, credits, used, has_paid, expires_at, created_at, last_export, data)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            email = EXCLUDED.email,
                            name = EXCLUDED.name,
                            credits = EXCLUDED.credits,
                            used = EXCLUDED.used,
                            has_paid = EXCLUDED.has_paid,
                            expires_at = EXCLUDED.expires_at,
                            last_export = EXCLUDED.last_export,
                            data = EXCLUDED.data;
                        """, (
                            k,
                            v.get("email"),
                            v.get("name"),
                            v.get("credits", 0),
                            v.get("used", 0),
                            bool(v.get("has_paid")),
                            v.get("expires_at"),
                            v.get("created_at", time.time()),
                            v.get("last_export"),
                            Json(v)
                        ))
        return True
    except Exception as e:
        print("[DB] Error saving device credits:", e)
        return False


def db_load_user_profile(user_id):
    if not is_db_enabled() or not user_id:
        return None
    try:
        init_db()
        with get_db() as conn:
            if not conn: return None
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM user_credits WHERE user_id = %s LIMIT 1;", (user_id,))
                row = cur.fetchone()
                if row:
                    u = dict(row.get("data") or {})
                    u.update({
                        "id": row["user_id"],
                        "email": row.get("email"),
                        "name": row.get("name"),
                        "credits": row.get("credits", 0),
                        "used": row.get("used", 0),
                        "has_paid": bool(row.get("has_paid")),
                        "expires_at": row.get("expires_at"),
                        "created_at": row.get("created_at"),
                        "last_login": row.get("last_login"),
                        "picture": row.get("picture"),
                    })
                    return u
        return {}
    except Exception as e:
        print("[DB] Error loading user profile:", e)
        return None


def db_save_user_profile(user_id, u_data):
    if not is_db_enabled() or not user_id or not isinstance(u_data, dict):
        return False
    try:
        init_db()
        with get_db() as conn:
            if not conn: return False
            with conn.cursor() as cur:
                cur.execute("""
                INSERT INTO user_credits (user_id, email, name, credits, used, has_paid, expires_at, created_at, last_login, picture, data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    email = EXCLUDED.email,
                    name = EXCLUDED.name,
                    credits = EXCLUDED.credits,
                    used = EXCLUDED.used,
                    has_paid = EXCLUDED.has_paid,
                    expires_at = EXCLUDED.expires_at,
                    last_login = EXCLUDED.last_login,
                    picture = EXCLUDED.picture,
                    data = EXCLUDED.data;
                """, (
                    user_id,
                    u_data.get("email"),
                    u_data.get("name"),
                    u_data.get("credits", 0),
                    u_data.get("used", 0),
                    bool(u_data.get("has_paid")),
                    u_data.get("expires_at"),
                    u_data.get("created_at", time.time()),
                    u_data.get("last_login", time.time()),
                    u_data.get("picture"),
                    Json(u_data)
                ))
        return True
    except Exception as e:
        print("[DB] Error saving user profile:", e)
        return False


def db_load_redeemed_coupons():
    if not is_db_enabled():
        return None
    try:
        init_db()
        with get_db() as conn:
            if not conn: return None
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM redeemed_coupons;")
                rows = cur.fetchall()
                out = {}
                for r in rows:
                    rec = dict(r.get("data") or {})
                    rec.update({
                        "code": r.get("code"),
                        "user_id": r.get("user_id"),
                        "device_id": r.get("device_id"),
                        "email": r.get("email"),
                        "ts": r.get("timestamp")
                    })
                    out[r["key"]] = rec
                return out
    except Exception as e:
        print("[DB] Error loading redeemed coupons:", e)
        return None


def db_save_redeemed_coupons(redeemed):
    if not is_db_enabled() or not isinstance(redeemed, dict):
        return False
    try:
        init_db()
        with get_db() as conn:
            if not conn: return False
            with conn.cursor() as cur:
                for k, v in redeemed.items():
                    if isinstance(v, dict):
                        cur.execute("""
                        INSERT INTO redeemed_coupons (key, code, user_id, device_id, email, timestamp, data)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (key) DO UPDATE SET
                            code = EXCLUDED.code,
                            user_id = EXCLUDED.user_id,
                            device_id = EXCLUDED.device_id,
                            email = EXCLUDED.email,
                            timestamp = EXCLUDED.timestamp,
                            data = EXCLUDED.data;
                        """, (
                            k,
                            v.get("code"),
                            v.get("user_id"),
                            v.get("device_id"),
                            v.get("email"),
                            v.get("ts", time.time()),
                            Json(v)
                        ))
        return True
    except Exception as e:
        print("[DB] Error saving redeemed coupons:", e)
        return False


def db_load_razorpay_payments():
    if not is_db_enabled():
        return None
    try:
        init_db()
        with get_db() as conn:
            if not conn: return None
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM payments ORDER BY timestamp DESC;")
                rows = cur.fetchall()
                out = []
                for r in rows:
                    p = dict(r.get("data") or {})
                    p.update({
                        "order_id": r.get("order_id"),
                        "payment_id": r.get("payment_id"),
                        "pack_id": r.get("pack_id"),
                        "amount_inr": r.get("amount_inr"),
                        "credits": r.get("credits"),
                        "device_id": r.get("device_id"),
                        "email": r.get("email"),
                        "name": r.get("name"),
                        "timestamp": r.get("timestamp"),
                        "date": r.get("date_str"),
                    })
                    out.append(p)
                return out
    except Exception as e:
        print("[DB] Error loading payments:", e)
        return None


def db_save_razorpay_payments(payments_data):
    if not is_db_enabled() or not isinstance(payments_data, list):
        return False
    try:
        init_db()
        with get_db() as conn:
            if not conn: return False
            with conn.cursor() as cur:
                for p in payments_data:
                    if isinstance(p, dict):
                        oid = p.get("order_id") or p.get("payment_id") or f"pay_{time.time()}"
                        cur.execute("""
                        INSERT INTO payments (order_id, payment_id, pack_id, amount_inr, credits, device_id, email, name, timestamp, date_str, data)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (order_id) DO UPDATE SET
                            payment_id = EXCLUDED.payment_id,
                            pack_id = EXCLUDED.pack_id,
                            amount_inr = EXCLUDED.amount_inr,
                            credits = EXCLUDED.credits,
                            device_id = EXCLUDED.device_id,
                            email = EXCLUDED.email,
                            name = EXCLUDED.name,
                            timestamp = EXCLUDED.timestamp,
                            date_str = EXCLUDED.date_str,
                            data = EXCLUDED.data;
                        """, (
                            oid,
                            p.get("payment_id"),
                            p.get("pack_id"),
                            p.get("amount_inr"),
                            p.get("credits"),
                            p.get("device_id"),
                            p.get("email"),
                            p.get("name"),
                            p.get("timestamp", time.time()),
                            p.get("date"),
                            Json(p)
                        ))
        return True
    except Exception as e:
        print("[DB] Error saving payments:", e)
        return False


def db_load_coupons():
    if not is_db_enabled():
        return None
    try:
        init_db()
        with get_db() as conn:
            if not conn: return None
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM coupons;")
                rows = cur.fetchall()
                out = dict(DEFAULT_COUPONS)
                for r in rows:
                    c = dict(r.get("data") or {})
                    c.update({
                        "credits": r.get("credits", 0),
                        "max_uses": r.get("max_uses"),
                        "unlimited": bool(r.get("unlimited")),
                        "days": r.get("days")
                    })
                    out[r["code"]] = c
                return out
    except Exception as e:
        print("[DB] Error loading coupons:", e)
        return None


def db_deduct_export_credit(export_id, user_email, device_id):
    """
    Safely deducts 1 credit inside a strict ACID transaction with export_id idempotency.
    Returns: (success: bool, remaining_credits: int, message: str)
    """
    if not is_db_enabled():
        return None  # Signal fallback to file-based deduction
    try:
        init_db()
        user_id = re.sub(r"\W", "_", user_email) if user_email else None
        with get_db() as conn:
            if not conn: return None
            with conn.cursor() as cur:
                # 1. Idempotency Check: if export_id already recorded, do not deduct again
                cur.execute("SELECT credits_deducted FROM export_events WHERE export_id = %s;", (export_id,))
                existing_event = cur.fetchone()
                if existing_event:
                    # Already deducted, return current credits
                    cur_credits = 0
                    if user_id:
                        cur.execute("SELECT credits FROM user_credits WHERE user_id = %s;", (user_id,))
                        r = cur.fetchone()
                        if r: cur_credits = r[0]
                    return True, cur_credits, "Already processed"

                # 2. Check and lock user or device row FOR UPDATE
                target_table = "user_credits" if user_id else "device_credits"
                target_key = user_id if user_id else device_id
                target_col = "user_id" if user_id else "id"

                if not target_key:
                    return False, 0, "No user or device identifier provided"

                cur.execute(f"SELECT credits, used FROM {target_table} WHERE {target_col} = %s FOR UPDATE;", (target_key,))
                row = cur.fetchone()
                if not row:
                    # New user with 1 free credit: create row, deduct to 0
                    cur_credits = 1
                    cur_used = 0
                else:
                    cur_credits = row[0] or 0
                    cur_used = row[1] or 0

                if cur_credits <= 0:
                    return False, 0, "Insufficient credits (0 credits remaining)"

                new_credits = max(0, cur_credits - 1)
                new_used = cur_used + 1
                now_ts = time.time()

                # Update balance
                if user_id:
                    cur.execute("""
                    INSERT INTO user_credits (user_id, email, credits, used, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                        credits = %s,
                        used = %s;
                    """, (user_id, user_email, new_credits, new_used, now_ts, new_credits, new_used))
                if device_id:
                    cur.execute("""
                    INSERT INTO device_credits (id, email, credits, used, created_at, last_export)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        credits = %s,
                        used = %s,
                        last_export = %s;
                    """, (device_id, user_email, new_credits, new_used, now_ts, now_ts, new_credits, new_used, now_ts))

                # Insert export event
                cur.execute("""
                INSERT INTO export_events (export_id, user_id, email, device_id, credits_deducted, created_at)
                VALUES (%s, %s, %s, %s, 1, %s);
                """, (export_id, user_id, user_email, device_id, now_ts))

                return True, new_credits, "Success"
    except Exception as e:
        print("[DB] Transaction error in db_deduct_export_credit:", e)
        return False, 0, str(e)
