import dotenv from "dotenv"
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config()

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () =>{
        console.log(`server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed", err);
})
/*
import express from "express";
const app = express()

( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("ERROR: ", error);
            throw error
        })
        app.listne(process.env.PORT, () =>{
            console.log(`APP is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.log("ERROR: ", error)
        throw error
    }
})()
*/