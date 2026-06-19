# Hunarmand Punjab - Exam Form API

The backend microservice and API gateway driving the **Exam Form Portal** for **Hunarmand Punjab**. 

---

## 🚀 Backend Overview

This API handles student registration validations, credentials matching with the master student records database, caching registry data for optimized dashboard loading, role-based authorization for administrative workflows, and memory-efficient background exports of massive datasets.

## 🛠️ Tech Stack & Architecture
- **Runtime**: Node.js & Express 5.x
- **Database**: MongoDB Atlas via Mongoose
- **Caching**: Redis (30-second query caching on candidates and statistics with automatic invalidations on registration, edits, or deletions)
- **Security**:
  - Express-compatible custom query injection sanitization (`mongoSanitize`)
  - HTTP headers security protection via `helmet`
  - CORS-enabled requests
  - IP-based rate limiting on entry submission routes
- **Key Backend Features**:
  - **Master Database Sync**: Checks candidates against master student registry (matching via CNIC, Email, or Roll Number) and enforces valid academic batch windows (July 7, 2025 – March 31, 2026).
  - **Memory-Efficient Streaming Exports**: Low-memory streaming Excel exporter utilizing `exceljs` cursor streams, preventing server crashes when exporting 100,000+ candidates.
  - **Role-Based Access Control (RBAC)**: Middleware restricting write, delete, and export permissions based on admin roles (superadmin, admin, viewer).
  - **Audit Logs**: Generates record trails for every administrative action.

---

## 💻 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root backend directory:
   ```env
   MONGODB_URI=your_primary_db_uri
   MASTER_MONGODB_URI=your_master_db_uri
   PORT=5001
   JWT_SECRET=your_secret_key
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   # or
   nodemon ./server.js
   ```

4. **Start Production Service**:
   ```bash
   pm2 start ecosystem.config.js
   ```

---

## ✒️ Developer Credits

- **Senior Developer**: **Dev Asad**
- **Website**: [devasad.stackfellows.com](http://devasad.stackfellows.com)
- **Organization**: **Hunarmand Punjab**

---
© 2026 Hunarmand Punjab. All rights reserved.
