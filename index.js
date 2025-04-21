import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "your database name",
  password: "Your postgres password",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [];

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;", [currentUserId]);
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function checkUser(){
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId)
}

app.get("/", async (req, res) => {

  const countries = await checkVisisted();
  const currentUser = await checkUser();

  const result = await db.query("SELECT *  FROM visited_countries");

  let welcomeMessage = null;
  if (currentUser) {
    welcomeMessage = `Hello ${currentUser.name}, Where have you been these days?`;
  }

  if(result.rows.length> 0){
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
      error: welcomeMessage
    });
  } else{
    res.render("index.ejs", {
      countries: [],
      users: users,
      total: 0,
      color: null,
      error: welcomeMessage
    })
  }
   
  
  
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  const countries = await checkVisisted();
  const currentUser = await checkUser();

  if(users.length === 0){
    return res.render("index.ejs", {
      error: `First Add a family member`,
      countries:[],
      total: 0,
      users: users,
      color: null,
    })
  }

  try{
      // checking if something has entered
    if(input.length === 0){
      return res.render("index.ejs", {
        error: `At least enter something`,
        countries: countries,
        total: countries.length,
        users: users, 
        color: currentUser.color,
      })
    }

    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;

      // checking if already exist
    const alreadyVisited = await db.query(
      "SELECT * FROM visited_countries WHERE country_code = $1 AND user_id = $2",
      [countryCode, currentUserId]
    );

    if(alreadyVisited.rows.length>0 ){ 
      return res.render("index.ejs", {
        error: `Country already exist`,
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
      })
    }

      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    
      // checking if wrong name has been entered
  } catch (error){
    res.render("index.ejs", {
      error: `Please enter the correct country name`,
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
    })
  } 
});

app.post("/user", async (req, res) => {
  if(req.body.add === 'new'){
    res.render("new.ejs")
  } else  {
    currentUserId = req.body.user;
    res.redirect("/")
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  if(name.length === 0){
    return res.render("new.ejs", {
      error: `At least enter your name`,
    })
  }

  if(!color){
    return res.render('new.ejs', { 
      showAlert: true,
      value: name
     });
  }

  const result = await db.query( 
    "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *",[name, color] );
  const id = result.rows[0].id;
  currentUserId = id;
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
