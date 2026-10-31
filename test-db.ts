import { testDatabase } from "./db.js";

testDatabase()
    .then((result) => {
        console.log("Database connected!");
        console.log(result);
        process.exit(0);
    })
    .catch((error) => {
        console.error("Database connection failed:");
        console.error(error);
        process.exit(1);
    });