const express = require('express');
const app = express();
const fs = require('fs');
var sqlite = require('sqlite3');
var session = require('express-session');
//const bcrypt = require('bcrypt');

// var FileStore = require('session-file-store')(session);

const AssistantV1 = require('ibm-watson/assistant/v1');
const { IamAuthenticator } = require('ibm-watson/auth');

var path = require('path');
var bodyParser = require('body-parser');
var httpsMsgs = require('http-msgs');

app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// app.use(
//   session({
//     secret: 'keyboard cat',
//     resave: false,
//     saveUninitialized: true,
//   })
// );

// var db = new sqlite.Database('db/botlists.db');
var db = new sqlite.Database('db/botlists.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the botlists SQlite database.');
});

var sql = `SELECT id bot_id,
          url bot_url,
          image_url bot_image,
          apikey bot_api,
          workspaceID bot_workspaceid,
          description d_w    
          FROM botlists
          WHERE id  = ?`;
app.get('/', function(req, res) {
  res.render('login.ejs');
});
app.post('/login_process', function(req, res) {
  const password = req.body.pswd;
  // const hashPassword =  bcrypt.hash(req.body.pswd, 10);
  // console.log(hashPassword);
  var sqls = `SELECT email useremail,
                  password userpassword
           FROM userlists
           WHERE email  = ?`;
  var email = req.body.email;

  // first row only
  db.get(sqls, [email], (err, row) => {
    if (err) {
      return console.error(err.message);
    }

    if (row.userpassword == password) {
      console.log(row.userpassword);
      console.log(password);

      res.redirect('homepage');
    } else {
      console.log(row.userpassword, password);
      res.redirect('login_process');
    }
  });
});

app.post('/register_process',  (req, res) => {
  try {
    console.log('success');
    //const hashPassword = await bcrypt.hash(req.body.pswd, 10);

    // res.send('Confirm your password');

   // console.log(hashPassword, req.body.pswd);
    db.run(
      `INSERT INTO userlists( username, email, password) VALUES( "` +
        req.body.username +
        `", "` +
        req.body.email +
        `","` +
        req.body.pswd +
        `")`,
      function(err) {
        if (err) {
          return console.log(err.message);
        }
        // get the last insert id
        console.log(`A row has been inserted with rowid ${this.lastID}`);
        res.redirect('login_process');
      }
    );
  } catch (error) {
    res.redirect('register_process');
  }
});

app.get('/login_process', function(req, res) {
  res.render('login.ejs');
});

app.get('/register_process', function(req, res) {
  res.render('register.ejs');
});

app.get('/homepage', function(req, res) {
  var all_list = [];
  db.serialize(function() {
    db.each(
      'SELECT * FROM botlists',
      function(err, row) {
        all_list.push(row);
      },
      function() {
        // All done fetching records, render response
        res.render('homepage.ejs', {
          bots: all_list,
        });
      }
    );
  });
});

app.post('/intent', function(req, ress) {
  var _des = req.body.des;
  console.log(_des);
  var _id = req.body.text;
  var id = _id;

  // id row only
  db.get(sql, [id], (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    const service = new AssistantV1({
      version: '2019-02-28',
      authenticator: new IamAuthenticator({
        apikey: row.bot_api,
      }),
      url: row.bot_url,
    });
    const params = {
      workspaceId: row.bot_workspaceid,
    };

    service
      .listIntents(params)
      .then((res) => {
        var intentlist = res.result.intents;
        httpsMsgs.sendJSON(req, ress, {
          intent: intentlist,
          image: row.bot_image,
        });
      })
      .catch((err) => {
        console.log(err);
      });
  });
});

app.post('/question', function(req, ress) {
  var _intent = req.body.text;
  var _id = req.body.des;
  var id = _id;

  // id row only
  db.get(sql, [id], (err, row) => {
    if (err) {
      return console.error(err.message);
    }

    //and this also ibm watson...
    const service = new AssistantV1({
      version: '2019-02-28',
      authenticator: new IamAuthenticator({
        apikey: row.bot_api,
      }),
      url: row.bot_url,
    });

    const paramsintent = {
      workspaceId: row.bot_workspaceid,
      intent: _intent,
    };

    service
      .listExamples(paramsintent)
      .then((res) => {
        // console.log(JSON.stringify(res, null, 2));
        console.log(res.result.examples[0]);
        var resdata = res.result.examples[0];

        httpsMsgs.sendJSON(req, ress, {
          question: res.result.examples[0].text,
        });
      })
      .catch((err) => {
        console.log(err);
      });
  });
});
app.post('/answer', function(req, ress) {
  var intent = req.body.text;
  var id = req.body.des;

  // id row only
  db.get(sql, [id], (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    //this  is integrated code with watson assistant...
    const service = new AssistantV1({
      version: '2019-02-28',
      authenticator: new IamAuthenticator({
        apikey: row.bot_api,
      }),
      url: row.bot_url,
    });

    service
      .message({
        workspaceId: row.bot_workspaceid,
        input: {
          text: intent,
        },
      })
      .then((res) => {
        console.log(res.result.output.text[0]);
        httpsMsgs.sendJSON(req, ress, {
          from: res.result.output.text[0],
        });
      })
      .catch((err) => {
        console.log(err);
      });
  });
});

app.post('/intent_dia', function(req, ress) {
  console.log(req.body);
  var id = req.body.text;

  // id row only
  db.get(sql, [id], (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    httpsMsgs.sendJSON(req, ress, {
      resp: row.bot_image,
      key: row.bot_api,
    });
  });
});
app.post('/save', function(req, res) {
  // console.log(req.body.text);
  var savedata = req.body.data;
  fs.writeFileSync('db/chatting.json', savedata);

  httpsMsgs.sendJSON(req, res, {
    resp: 'row.bot_image',
  });
});

app.listen('3000', function() {
  console.log('Server is running on port 3000.');
});
