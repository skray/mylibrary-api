require("dotenv").config();
const AWS = require("aws-sdk");
const express = require("express");
const cors = require("cors");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const xml2js = require("xml2js");
const uuidv4 = require("uuid/v4");
const bodyParser = require("body-parser");
const arrify = require("arrify");

const app = express();
const port = process.env.PORT || 3001;

AWS.config.update({
  region: "us-west-1",
  endpoint: process.env.DYNAMODB_ENDPOINT
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
        title: req.body.title,
        author: req.body.author,
        publicationYear: req.body.publicationYear,
        goodReads: {
          bookId: req.body.goodReads.bookId,
          authorId: req.body.goodReads.authorId,
          imageUrl: req.body.goodReads.imageUrl,
          rating: req.body.goodReads.rating
        }
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
          title: req.body.title,
          author: req.body.author,
          publicationYear: req.body.publicationYear,
          goodReads: {
            bookId: req.body.goodReads.bookId,
            authorId: req.body.goodReads.authorId,
            imageUrl: req.body.goodReads.imageUrl,
            rating: req.body.goodReads.rating
          }
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

app.delete(
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

        let response = {
          totalResults: result.GoodreadsResponse.search["total-results"],
          resultsStart: result.GoodreadsResponse.search["results-start"],
          resultsEnd: result.GoodreadsResponse.search["results-end"]
        };

        if (!response.totalResults) {
          response.books = [];
        } else {
          let works = arrify(result.GoodreadsResponse.search.results.work);
          response.books = works.map(work => ({
            title: work.best_book.title,
            author: work.best_book.name,
            publicationYear: work.original_publication_year,
            goodReads: {
              bookId: work.best_book.id,
              authorId: work.best_book.author.id,
              imageUrl: work.best_book.image_url,
              rating: work.average_rating
            }
          }));
        }

        res.set("Cache-Control", "private, max-age=86400");
        res.json(response);
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
