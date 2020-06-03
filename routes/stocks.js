var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var moment = require("moment"); // require

const authorise = (req, res, next) => {
  const { authorization } = req.headers;
  let token = null;

  if (authorization && authorization.split(" ").length === 2) {
    token = authorization.split(" ")[1];
    return res.status(201).json({
      success: true,
      token,
    });
  } else {
    res.status(400).json({ error: true, message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.exp > Date.now()) {
      return res.status(403).json({ error: true, message: "jwt expired" });
    }
    // permit user to advance to route
    next();
  } catch (err) {
    return res.status(403).json({ error: true, message: "token is invalid" });
  }
};
/*
 *  if no parameter is provided after /stocks, throw an error message
 */
router.get("/", function (req, res, next) {
  const { symbol } = req.params;
  if (!symbol) {
    return res.status(400).json({
      error: true,
      message:
        "Request on /stocks must include symbol as path parameter, or alternatively you can hit /stocks/symbols to get all symbols",
    });
  }
});
/*
 *  Returns all available stocks, optionally filtered by industry sector.
 */
router.get("/symbols", function (req, res, next) {
  const { industry } = req.query;
  const stocksQuery = req.db
    .from("stocks")
    .select("name", "industry", "symbol")
    .distinct();

  const industryQuery = req.db
    .from("stocks")
    .select("name", "industry", "symbol")
    .where("industry", "like", `%${industry}%`)
    .distinct();

  //if no query parameter is provided set the url to: stocks/symbols to display all stocks
  if (Object.keys(req.query).length === 0) {
    stocksQuery
      .then((rows) => {
        // if data exists
        if (rows.length === 0) {
          return res.status(404).json({ error: true, message: "Forbidden" });
        } else {
          return res.status(200).json(rows);
        }
      })
      .catch((err) => console.log(err));
  } else {
    // if the industry query is not attached to the request url, throw an error exception
    if (!industry) {
      return res.status(400).json({
        error: true,
        message: "Invalid query parameter: only 'industry' is permitted",
      });
    } else {
      industryQuery
        .then((rows) => {
          // if no record is found, throw an error message, otherwise return the data
          if (rows.length === 0) {
            return res
              .status(404)
              .json({ error: true, message: "Industry sector not found" });
          } else {
            return res.status(200).json(rows);
          }
        })
        .catch((err) => console.log(err));
    }
  }
});

/*
 * Returns the latest entry for a particular stock searched by symbol (1-5 upper case letters).
 */
router.get("/:symbol", function (req, res, next) {
  const { symbol } = req.params;
  // If req.query.symbol contains lowercase or has more than 5 characters, throw an error message,
  if (hasLowerCase(symbol) || symbol.length > 5) {
    return res.status(400).json({
      error: true,
      message: "Stock symbol incorrect format - must be 1-5 capital letters",
    });
  } else if (Object.keys(req.query).length != 0) {
    return res.status(400).json({
      error: true,
      message:
        "Date parameters only available on authenticated route /stocks/authed",
    });
  } else {
    // otherwise, query the database
    req.db
      .from("stocks")
      .select("*")
      .where("symbol", "=", symbol)
      .then((rows) => {
        // check for stock's entry`
        if (rows == 0) {
          return res.status(404).json({
            error: true,
            message: "No entry for symbol in stocks database",
          });
        } else {
          // grab the first result from the array
          return res.status(200).json(rows[0]);
        }
      });
  }
});

router.get("/authed/:symbol", function (req, res, next) {
  const { from } = req.query;
  const { to } = req.query;
  const { symbol } = req.params;
  const parsedFrom = moment(from).format("YYYY/MM/DD");
  const parsedTo = moment(to).format("YYYY/MM/DD");

  const symbolQuery = req.db
    .from("stocks")
    .select("*")
    .where("symbol", "=", symbol);
  const fromQuery = req.db
    .from("stocks")
    .select("*")
    .where("symbol", "=", symbol)
    .where("timestamp", "like", from)
    .distinct();

  const toQuery = req.db
    .from("stocks")
    .select("*")
    .where("symbol", "=", symbol)
    .where("timestamp", "like", to)
    .distinct();

  const fromToQuery = req.db
    .from("stocks")
    .select("*")
    .where("symbol", "=", symbol)
    .where("timestamp", ">=", parsedFrom)
    .where("timestamp", "<=", parsedTo)
    .distinct();
  // if no autorisation header is found, terminate current process and throw error message
  if (!req.headers.authorization) {
    return res.status(403).json({
      error: true,
      message: "Authorization header not found",
    });
  }
  // If req.query.symbol contains lowercase or has more than 5 characters, throw an error message,
  if (hasLowerCase(symbol) || symbol.length > 5) {
    return res.status(400).json({
      error: true,
      message: "Stock symbol incorrect format - must be 1-5 capital letters",
    });
  } else {
    // otherwise, query the database
    if (Object.keys(req.query).length === 0) {
      symbolQuery.then((rows) => {
        // check if stock(filtered by sybol) is available in the database
        if (rows == 0) {
          res.status(404).json({
            error: true,
            message: "No entry for symbol in stocks database",
          });
        } else {
          // grab the first result from the array
          res.status(200).json(rows[0]);
        }
      });
    } else {
      if (from && !to) {
        fromQuery.then((rows) => {
          if (rows.length == 0) {
            return res.status(404).json({
              error: true,
              message:
                "No entries available for query symbol for supplied date range",
            });
          } else {
            return res.status(200).json(rows);
          }
        });
      } else if (!from && to) {
        toQuery.then((rows) => {
          if (rows.length == 0) {
            return res.status(404).json({
              error: true,
              message:
                "No entries available for query symbol for supplied date range",
            });
          } else {
            return res.status(200).json(rows);
          }
        });
      } else if (from && to) {
        fromToQuery.then((rows) => {
          if (rows.length == 0) {
            return res.status(404).json({
              error: true,
              message:
                "No entries available for query symbol for supplied date range",
            });
          } else {
            return res.status(200).json(rows);
          }
        });
      } else {
        return res.status(400).json({
          error: true,
          message:
            "Parameters allowed are 'from' and 'to', example: /stocks/authed/AAL?from=2020-03-15",
        });
      }
    }
  }
});

function hasLowerCase(str) {
  return str.toUpperCase() != str;
}

module.exports = router;
