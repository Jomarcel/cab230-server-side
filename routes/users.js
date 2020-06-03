var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

/*
 * User registration
 */
router.post("/register", function (req, res, next) {
  // extract email and password from req.body
  const { email } = req.body;
  const { password } = req.body;
  // verify body
  if (!email || !password) {
    res.status(400).json({
      error: true,
      message: "Request body incomplete - email and password needed",
    });
    return;
  } else {
    const queryUsers = req.db
      .from("users")
      .select("*")
      .where("email", "=", email);
    queryUsers.then((users) => {
      // check if user already exists in the database
      if (users.length > 0) {
        res.status(409).json({
          error: true,
          message: "User already exists!",
        });
        return;
      }
      // otherwise, insert new user with hashed password
      else {
        // Prepare to hash user's password
        const saltRounds = 10;
        const hash = bcrypt.hashSync(password, saltRounds);
        req.db
          .from("users")
          .insert({ email, hash })
          .then(() => {
            return res.status(201).json({
              success: true,
              message: "User created",
            });
          })
          .catch((err) => {
            console.log(err);
            res.json({ Error: true, Message: "Error in MySQL query" });
          });
      }
    });
  }
});

router.post("/login", function async(req, res, next) {
  // extract email and password from req.body
  const { email } = req.body;
  const { password } = req.body;

  // Displays an error exception if username or password input is empty/null
  if (!email || !password) {
    res.status(400).json({
      error: true,
      message: "Request body invalid - email and password are required",
    });
    return;
  } else {
    const queryUsers = req.db
      .from("users")
      .select("*")
      .where("email", "=", email);

    queryUsers
      .then((users) => {
        if (users.length === 0) {
          res.status(401).json({
            error: true,
            message: "Incorrect email or password",
          });
        }
        // user does esist in
        const user = users[0];
        return bcrypt.compare(password, user.hash);
        // console.log(user);
      })
      .then((match) => {
        // if no match is found
        if (!match) {
          return res.status(401).json({
            error: true,
            message: "Cannot find a match",
          });
        } else {
          // there is match! User has succesdfully log onto the system
          console.log("you have logged in");
          const secretKey = "secret key";
          const expires_in = 60 * 60 * 24;
          const exp = Math.floor(Date.now() / 1000) + expires_in;
          const token = jwt.sign({ email, exp }, secretKey);
          res.status(200).json({
            token,
            token_type: "Bearer",
            expires_in,
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({ Error: true, Message: "Error in MySQL query" });
      });
  }
});

module.exports = router;
