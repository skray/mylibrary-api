require("dotenv").config();

const express = require("express");
const cors = require("cors");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const parseString = require("xml2js").parseString;

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://mylibrary.cool",
      "https://www.mylibrary.cool"
    ]
  })
);

app.get("/", (req, res) => res.send({ hello: "world" }));

app.get(
  "/books",
  asyncHandler(async (req, res) => {
    let searchResults = await axios.get(
      "https://www.goodreads.com/search/index.xml",
      {
        params: {
          key: process.env.GOODREADS_API_KEY,
          q: req.query.q
        },
        responseType: "text"
      }
    );

    parseString(
      searchResults.data,
      { ignoreAttrs: true, explicitArray: false },
      function(err, result) {
        res.json(result.GoodreadsResponse.search);
      }
    );
  })
);

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`App started at http://localhost:${port}`));
