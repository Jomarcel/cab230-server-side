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
  } else if (!authorization) {
    return res
      .status(403)
      .json({ error: true, message: "Authorization header not found" });
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
    // console.log("token is invalid");
    res.status(403).json({ error: true, message: "token is invalid" });
  }
};
// || Object.keys(req.query).length != 0
/*
 * Returns all available stocks, optionally filtered by industry sector.
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

  //if no query parameter is present default to url: stocks/symbols
  if (Object.keys(req.query).length === 0) {
    stocksQuery
      .then((rows) => {
        // if data exists
        if (rows.length === 0) {
          return res.status(404).json({ error: true, message: "NOT FOUND" });
        } else {
          return res.status(200).json(rows);
        }
      })
      .catch((err) => console.log(err));
  } else {
    // if the industry query is not attached to the request url, throw an error exception
    // console.log(Object.keys(req.query).includes("industry"));
    if (!Object.keys(req.query).includes("industry")) {
      return res.status(400).json({
        error: true,
        message: "Invalid query parameter: only 'industry' is permitted",
      });
    } else {
      industryQuery
        .then((rows) => {
          // if data exists
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
  console.log(symbol);
  // check if query is lowercase and is within the range of 5 characters
  if (hasLowerCase(symbol) || symbol.length > 5) {
    return res.status(400).json({
      error: true,
      message: "Stock symbol incorrect format - must be 1-5 capital letters",
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

// http://localhost:3001/sample?id=123
// http://131.181.190.87:3005/stocks/authet6d/AAL?from=2020-03-15T00%3A00%3A00.000Z&to=2020-03-20T00%3A00%3A00.000Z
router.get("/authed/:symbol", function (req, res, next) {
  // console.log(authorise);
  const response = authorise;
  console.log(response);

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
    .where("timestamp", "like", `%${from}%`)
    .distinct();

  const toQuery = req.db
    .from("stocks")
    .select("*")
    .where("symbol", "=", symbol)
    .where("timestamp", "like", `%${to}%`)
    .distinct();

  const fromToQuery = req.db
    .from("stocks")
    .select("*")
    .where("symbol", "=", symbol)
    .where("timestamp", ">=", parsedFrom)
    .where("timestamp", "<=", parsedTo)
    .distinct();

  if (response) {
    console.log("heelo");
  }
  // if (`/[a-z]{1,5}/g` == symbol) {
  if (hasLowerCase(symbol) || symbol.length > 5) {
    return res.status(400).json({
      error: true,
      message: "Stock symbol incorrect format - must be 1-5 capital letters",
    });
  } else {
    if (Object.keys(req.query).length === 0) {
      symbolQuery.then((rows) => {
        // check for stock's entry
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
      } else if (!from && !to) {
        return res.status(400).json({
          error: true,
          message:
            "Parameters allowed are 'from' and 'to', example: /stocks/authed/AAL?from=2020-03-15",
        });
      }
    }
    // otherwise, query the database
  }
});

function throwErrSymbol() {
  return res.status(404).json({
    error: true,
    message: "No entries available for query symbol for supplied date range",
  });
}
function hasLowerCase(str) {
  return str.toUpperCase() != str;
}

module.exports = router;

// if (
//   Object.keys(symbol).length === 0 ||
//   hasLowerCase(symbol) ||
//   symbol.length > 5
// ) {
//   return res.status(400).json({
//     error: true,
//     message: "Stock symbol incorrect format - must be 1-5 capital letters",
//   });
// }
// // otherwise, search for stock
// else {
//   // otherwise, query the database
//   req.db
//     .from("stocks")
//     .select("*")
//     .where("symbol", "=", symbol)
//     .then((rows) => {
//       // check for stock's entry
//       if (rows == 0) {
//         return res.status(404).json({
//           error: true,
//           message: "No entry for symbol in stocks database",
//         });
//       } else {
//         //return first entry in the database
//         if (Object.keys(req.query).length === 1) {
//           // console.log("you hit from");
//           fromQuery.then((rows) => {
//             if (rows.length === 0) {
//               return res.status(404).json({
//                 error: true,
//                 message:
//                   "No entries available for query symbol for supplied date range",
//               });
//             } else {
//               return res.status(200).json(rows);
//             }
//           });
//         } else {
//           return res.status(200).json(rows[0]);
//         }
//       }
//     });
// }

// console.log(Object.keys(req.query));
// if no query if found, fetch all stocks
// if (Object.keys(req.query) != "industry") {
//   return res.status(400).json({
//     error: true,
//     message: "Invalid query parameter: only 'industry' is permitted",
//   });
// } else {
// }

// } else {
//   if (!industry) {
//     stocksQuery
//       .then((rows) => {
//         // if data exists
//         if (rows.length === 0) {
//           res
//             .status(404)
//             .json({ error: true, message: "Industry sector not found" });
//         } else {
//           res.status(200).json(rows);
//         }
//       })
//       .catch((err) => console.log(err));
//   }
//   // otherwise, search for stock
//   else {
//     req.db
//       .from("stocks")
//       .select("name", "industry", "symbol")
//       .where("industry", "like", `%${industry}%`)
//       .distinct()
//       .then((rows) => {
//         // if data exists
//         if (rows.length === 0) {
//           res
//             .status(404)
//             .json({ error: true, message: "Industry sector not found" });
//         } else {
//           res.status(200).json(rows);
//         }
//       })
//       .catch((err) => console.log(err));
//   }
// }
