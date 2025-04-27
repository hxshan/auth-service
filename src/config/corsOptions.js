const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:8000",
  "http://localhost:5173"
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("came to this origin")
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

module.exports = { corsOptions };