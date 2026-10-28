# ☁️ CaptionStudio Pro Storage Guide (Cloud Storage & Smart Janitor)

Your application is now equipped with a **Smart Storage Janitor** and **Free Cloud Storage Support (Cloudflare R2 / AWS S3)**.

---

## 1. 🧹 Smart Storage Janitor (Already Active & 100% Automatic)
You don't need to configure anything for this — it is running automatically in the background:
* **Never Runs Out of Disk**: If the server storage exceeds 1.2 GB, the system automatically finds and deletes the oldest unused files (LRU eviction).
* **Automatic Expiry**: Deletes temporary files after 6 hours.
* **Immediate Cleanup**: Orphaned temporary audio and analysis scratch files are removed automatically.

---

## 2. ☁️ How to Connect Free Cloudflare R2 (10 GB Free Forever)

If you want your users' exported videos to be stored permanently in the cloud (so they never disappear even when Render restarts):

1. **Create a Free Cloudflare Account** at [cloudflare.com](https://cloudflare.com).
2. Go to **R2 Object Storage** -> click **Create Bucket** (name it `captionstudio-storage`).
3. Click **Manage R2 API Tokens** -> **Create API Token** (give it *Object Read & Write* permissions).
4. In your **Render Dashboard** (`https://dashboard.render.com`), go to your web service -> **Environment** -> Add these variables:
   * `R2_ACCOUNT_ID`: Your Cloudflare Account ID
   * `R2_ACCESS_KEY_ID`: Your R2 Access Key ID
   * `R2_SECRET_ACCESS_KEY`: Your R2 Secret Access Key
   * `R2_BUCKET_NAME`: `captionstudio-storage`
   * `R2_PUBLIC_URL`: (Optional) Your public R2 bucket domain or custom domain

---

## 3. How It Works
* If Cloudflare R2 variables are set: Every exported video is saved to the cloud, giving users fast, permanent CDN download and stream links.
* If not set: The Smart Storage Janitor manages everything locally on Render safely without crashing.
