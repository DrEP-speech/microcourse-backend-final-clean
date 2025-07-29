# MicroCourse Backend API – Auto-Run Postman Collection

**Version:** v1.0.0  
**Release Date:** July 29, 2025  

This is the finalized backend API Postman collection for **MicroCourse**, designed for beginners to easily test the full user flow:  
**Register → Login → Get Profile**  

---

## 1. Import the Environment and Collection

1. Open **Postman**.
2. Click **Import** → **Upload Files**.
3. Select:
   - `MicroCourse_Backend_AutoRun.postman_collection.json`
   - `MicroCourse_Backend.postman_environment.json`

![Import Screenshot](./screenshots/import.png)

---

## 2. Select the Environment

1. In the top-right corner of Postman, click the environment dropdown.
2. Select: **MicroCourse API Environment**

![Select Environment Screenshot](./screenshots/select-environment.png)

---

## 3. Run the Auto-Run Collection

1. Go to the **Collections** tab.
2. Hover over **MicroCourse Backend API (Auto-Run)** and click **Run Collection**.

![Run Collection Screenshot](./screenshots/run-collection.png)

---

## 4. What Happens in Auto-Run?

- **Register User:** If the user already exists (409), it will skip and move to login.
- **Login User:** Authenticates the user and saves the `token`.
- **Get Profile:** Uses the saved `token` to call the protected profile endpoint.

![Result Screenshot](./screenshots/result.png)

---

## 5. Troubleshooting

### **1. 409: User Already Exists**
- This is normal. The test script will skip the Register step and move to Login.

### **2. 401: Invalid or Expired Token**
- Run the collection again to refresh the token.

### **3. Token Variable is Empty**
- Make sure you selected the correct environment (`MicroCourse API Environment`) before running the collection.
- Check the **Tests tab** in the **Login User** request – it sets the token dynamically.

### **4. Requests Not Chaining**
- Always use **Run Collection**. If you only click "Send" on a single request, chaining will not work.

![Error Screenshot](./screenshots/error.png)

---

## 6. How to Reset If You Mess Up the Environment or Variables (Beginner-Friendly)

1. **Delete the Environment:**
   - In Postman, click the gear icon ⚙️ (top right).
   - Find **MicroCourse API Environment**, click the trash 🗑️ icon, and confirm.

2. **Delete the Collection:**
   - Right-click **MicroCourse Backend API (Auto-Run)** in the left sidebar.
   - Click **Delete**.

3. **Re-import Fresh Copies:**
   - Follow **Step 1: Import the Environment and Collection** above.
   - This ensures all variables (`token`, `base_url`) are fresh and correct.

⚡ **Tip:** If you are unsure, deleting and re-importing is the quickest way to start clean.

---

## Changelog

### **v1.0.0 – Initial Stable Release**
- Added complete Register → Login → Profile auto-run collection.
- Dynamic token saving and usage.
- Beginner-friendly documentation with fresh screenshots.
- Added reset instructions for beginners.

---
