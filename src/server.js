require('dotenv').config()
const express = require('express')
const app = express()
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const connection = require('./db')
const customerAuthRoutes = require('./routes/customerAuthRoutes.js')
const driverAuthRoutes = require("./routes/driverAuthRoutes");
const restaurantAuthRoutes = require("./routes/restaurantAuthRoutes");
const userRoutes = require("./routes/userRoutes.js")


//database
connection()

app.use(cors(corsOptions));

app.use(express.json());

//routes
app.use("/customer", customerAuthRoutes);
app.use("/driver", driverAuthRoutes);
app.use("/restaurant", restaurantAuthRoutes);
app.use("/users",userRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

const port = process.env.PORT || 5002;
app.listen(port, ()=> console.log(`Listening on port ${port}...`))

