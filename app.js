require("dotenv").config();
const AWS = require("aws-sdk");
const express = require("express");
const cors = require("cors");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const xml2js = require("xml2js");
const uuidv4 = require("uuid/v4");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3001;

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

const docClient = new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json());
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
  "/my-books",
  asyncHandler(async (req, res, next) => {
    docClient.scan({ TableName: "mybooks" }, function(err, data) {
      if (err) {
        return next(err);
      } else {
        res.json(data.Items);
      }
    });
  })
);

app.post(
  "/my-books",
  asyncHandler(async (req, res, next) => {
    let book = {
      TableName: "mybooks",
      Item: {
        id: uuidv4(),
        title: req.body.title
      },
      ConditionExpression: "attribute_not_exists(id)"
    };
    docClient.put(book, function(err) {
      if (err) {
        return next(err);
      } else {
        var params = {
          TableName: "mybooks",
          Key: {
            id: book.Item.id
          }
        };
        docClient.get(params, function(err, data) {
          if (err) {
            return next(err);
          }
          res.status(201).json(data.Item);
        });
      }
    });
  })
);

app.get(
  "/my-books/:id",
  asyncHandler(async (req, res, next) => {
    const params = {
      TableName: "mybooks",
      Key: {
        id: req.params.id
      }
    };
    docClient.get(params, function(err, data) {
      if (err) {
        return next(err);
      } else {
        if (data.Item) {
          return res.json(data.Item);
        } else {
          return res.status(404).json({ message: "not found" });
        }
      }
    });
  })
);

app.put(
  "/my-books/:id",
  asyncHandler(async (req, res, next) => {
    const getParams = {
      TableName: "mybooks",
      Key: {
        id: req.params.id
      }
    };

    docClient.get(getParams, function(err, data) {
      if (err) {
        return next(err);
      } else {
        if (!data.Item) {
          return res.status(404).json({ message: "not found" });
        }

        let updatedBook = {
          id: req.params.id,
          title: req.body.title
        };
        docClient.put(
          {
            TableName: "mybooks",
            Item: updatedBook
          },
          function(err) {
            if (err) {
              return next(err);
            } else {
              return res.json(updatedBook);
            }
          }
        );
      }
    });
  })
);

app.del(
  "/my-books/:id",
  asyncHandler(async (req, res, next) => {
    const deleteParams = {
      TableName: "mybooks",
      Key: {
        id: req.params.id
      },
      ConditionExpression: "attribute_exists(id)"
    };

    docClient.delete(deleteParams, function(err) {
      if (err) {
        if (err.name === "ConditionalCheckFailedException") {
          return res.status(404).json({ message: "not found" });
        } else {
          return next(err);
        }
      } else {
        return res.status(204).send();
      }
    });
  })
);

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
        if (err) {
          throw err;
        }
        res.set("Cache-Control", "private, max-age=86400");
        res.json(result.GoodreadsResponse.search);
      }
    );
  })
);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  // eslint-disable-next-line no-console
  console.error(err.message || err, err.stack);
  res.status(500).json({ message: err.message || err.toString() });
});

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`App started at http://localhost:${port}`));
