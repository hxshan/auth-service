require('dotenv').config()
const express = require('express')
const app = express()
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const connection = require('./db')
const customerAuthRoutes = require('./routes/customerAuthRoutes.js')
const driverAuthRoutes = require("./routes/driverAuthRoutes");
const restaurantAuthRoutes = require("./routes/restaurantAuthRoutes");


//database
connection()

app.use(express.json());
app.use(cors(corsOptions));

//routes
app.use("/api/customer", customerAuthRoutes);
app.use("/api/driver", driverAuthRoutes);
app.use("/api/restaurant", restaurantAuthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

const port = process.env.PORT || 8080;
app.listen(port, ()=> console.log(`Listening on port ${port}...`))

