/**
 * خادم تطوير بسيط: يعرض الموقع + يرفع الصور لمجلد upload/ (مثل SaveAs في السيرفر).
 * شغّل من جذر المشروع: npm install ثم npm run dev
 * افتح: http://127.0.0.1:3847/admin.html
 */
"use strict";

var path = require("path");
var fs = require("fs");
var express = require("express");
var multer = require("multer");

var ROOT = __dirname;
var UPLOAD_DIR = path.join(ROOT, "upload");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeName(original) {
  var n = String(original || "image.png").trim() || "image.png";
  return n.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image.png";
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    var base = safeName(file.originalname);
    var dot = base.lastIndexOf(".");
    var stem = dot > 0 ? base.slice(0, dot) : base;
    var ext = dot > 0 ? base.slice(dot) : "";
    cb(null, stem + "_" + Date.now() + (ext || ".png"));
  },
});

var upload = multer({
  storage: storage,
  limits: { fileSize: 12 * 1024 * 1024 },
});

var app = express();

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.post("/api/upload", upload.single("file"), function (req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "no file" });
  }
  var rel = "upload/" + req.file.filename;
  res.json({ path: rel, url: rel });
});

app.use(express.static(ROOT));

var PORT = 3847;
app.listen(PORT, function () {
  console.log("");
  console.log("  Portfolio dev server");
  console.log("  http://127.0.0.1:" + PORT + "/admin.html");
  console.log("  Uploads go to folder: /upload");
  console.log("");
});
