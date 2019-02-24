require("dotenv").config();

const express = require("express");
const cors = require("cors");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const xml2js = require("xml2js");

const app = express();
const port = process.env.PORT || 8000;

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

    xml2js.parseString(
      searchResults.data,
      {
        ignoreAttrs: true,
        explicitArray: false,
        trim: true,
        emptyTag: null,
        valueProcessors: [xml2js.processors.parseNumbers]
      },
      function(err, result) {
        res.json(result.GoodreadsResponse.search);
      }
    );
  })
);

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`App started at http://localhost:${port}`));
