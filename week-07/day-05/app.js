'use strict';

require('dotenv').config();
const bodyParser = require('body-parser')
const mysql = require('mysql');
const express = require('express');
const app = express();
const path = require('path');
const PORT = 3100;
app.use(bodyParser.text())

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'reddit'
});

conn.connect(err => {
  if (err) {
    console.log(err.toString());
    return;
  }
  console.log('connection to DB is OK ✨');
});

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname+'/public/index.html'));
});


app.get('/login', function(req, res) {
  res.sendFile(path.join(__dirname+'/public/login.html'));
});

// app.get('/', function (req, res) {
//   res.sendFile(__dirname + '/public/login.html')
//   //login.html-en lesz egy form és egy submit button és meghívjuk onnan a /posts endpointot
//   //aminek a headerjében benne van a formban megadott username
//   //hogyan fogom megküldeni az index.htmlt?
// });

app.post('/auth', (req, res) => {
  console.log(req.headers.username)
  conn.query('SELECT * FROM users WHERE user_name = ?;', req.headers.username, (err, rows) => {
    if (err) {
      res.status(500).send('Get is that user alredy registered error');
      return;
      //Send back posts
    } else if (rows.length !== 0) {
      console.log('Im here')
      res.redirect('/');
    } else {
      res.status(201).send('This user not registered!');
      return;
    }
  });
});

app.get('/posts', function (req, res) {
  //Username megjön a getből és le kell csekkolni, hogy benne van e a userbe és ha igen akkor
  //vissza kell küldeni a contentet és az index.html-re áttérni
  //Check is that user in the database
  conn.query('SELECT * FROM users WHERE user_name = ?;', req.headers.username, (err, rows) => {
    if (err) {
      res.status(500).send('Get is that user alredy registered error');
      return;
      //Send back posts
    } else if (rows.length !== 0) {
      let queryGetAllPosts = `SELECT p1.id, p1.title, p1.url, p1.timestamp, CASE WHEN (SELECT SUM(vote)
      FROM votes WHERE post_id = p1.id GROUP BY post_id) IS NOT NULL THEN (SELECT SUM(vote)
      FROM votes WHERE post_id = p1.id GROUP BY post_id) ELSE 0 END AS score, 
      p1.owner_name, CASE WHEN p2.vote IS NULL THEN 0 ELSE p2.vote END AS vote FROM posts p1 
      LEFT JOIN (SELECT p.id, p.title, p.url, p.timestamp, p.owner_name, v.vote FROM posts p 
      JOIN votes v ON p.id = v.post_id WHERE v.user_name = ?) AS p2 ON p1.id = p2.id;`
      conn.query(queryGetAllPosts, req.headers.username, function (err, rows) {
        if (err) {
          res.status(500).send('Database get posts error');
          return;
        }
        res.type('application/json').status(200).send(rows);
      });
    } else {
      res.send('This user not registered')
    }
  });
});

app.post('/posts', function (req, res) {
  conn.query('SELECT * FROM users WHERE user_name = ?;', req.headers.username, (err, rows) => {
    if (err) {
      res.status(500).send('Get is that user alredy registered error');
      return;
    } else if (rows.length !== 0) {
      let post = {
        'title': JSON.parse(req.body).title,
        'url': JSON.parse(req.body).url,
        'owner_name': req.headers.username
      }
      conn.query('INSERT INTO posts SET ?', post, function (err, rows) {
        if (err) {
          res.status(500).send('Database post error');
          return;
        } else {
          conn.query('SELECT * FROM posts ORDER BY id DESC LIMIT ?;', 1, function (err, rows) {
            if (err) {
              res.status(500).send('Database select error');
              return;
            }
            res.type('application/json').status(200).send(rows);
          });
        }
      });
    } else {
      res.send('This user not registered')
    }
  });
});

app.put('/posts/:id/:vote', function (req, res) {
  conn.query('SELECT * FROM users WHERE user_name = ?;', req.headers.username, (err, rows) => {
    if (err) {
      res.status(500).send('Get is that user alredy registered error');
      return;
    } else if (rows.length !== 0) {
      let vote = req.params.vote
      let post_id = req.params.id
      let voter = req.headers.username
      conn.query('SELECT vote FROM votes WHERE post_id = ? AND user_name = ?', [post_id, voter], function (err, rows) {
        if (err) {
          res.status(500).send('Search is there a vote error');
          return;
        } else if ((rows.length !== 0 && rows[0].vote === 1 && vote === 'upvote') || (rows.length !== 0 && rows[0].vote === -1 && vote === 'downvote')) {
          conn.query('DELETE FROM votes WHERE post_id = ? AND user_name = ?', [post_id, voter], function (err, rows) {
            if (err) {
              res.status(500).send('Set vote to 0 error');
              return;
            }
            res.type('application/json').status(200).send(rows);
            return;
          });
        } else {
          let queryVote;
          if (vote === 'upvote') {
            if (rows.length !== 0) {
              queryVote = 'UPDATE votes SET vote = 1 WHERE post_id = ? AND user_name = ?'
            } else {
              queryVote = ' INSERT INTO votes(post_id, user_name, vote) VALUES (?,?,1);'
            }
          } else if (vote === 'downvote') {
            if (rows.length !== 0) {
              queryVote = 'UPDATE votes SET vote = -1 WHERE post_id = ? AND user_name = ?'
            } else {
              queryVote = ' INSERT INTO votes(post_id, user_name, vote) VALUES (?,?,-1);'
            }
          }
          conn.query(queryVote, [post_id, voter], function (err, rows) {
            if (err) {
              res.status(500).send('Upvote error');
              return;
            }
            res.type('application/json').status(200).send(rows);
          });
        }
      });
    } else {
      res.send('This user not registered')
    }
  });
});

app.delete('/posts/:id', function (req, res) {
  conn.query('SELECT * FROM users WHERE user_name = ?;', req.headers.username, (err, rows) => {
    if (err) {
      res.status(500).send('Get is that user alredy registered error');
      return;
    } else if (rows.length !== 0) {
      let post_id = req.params.id;
      conn.query('SELECT owner_name FROM posts WHERE id = ?', [req.params.id], function (err, rows) {
        if (err) {
          res.status(500).send('Search is there a vote error');
          return;
        } else if (req.headers.username === rows[0].owner_name) {
          conn.query('DELETE FROM posts WHERE id=?;', [post_id], function (err, rows) {
            if (err) {
              res.status(500).send('Upvote error');
              return;
            }
            res.status(200).type('application/json').send('succ deleted from posts')
          });
          conn.query('DELETE FROM votes WHERE post_id=?;', [post_id], function (err, rows) {
            if (err) {
              res.status(500).send('Upvote error');
              return;
            }
            res.type('application/json').status(200).send('succ deleted from votes')
          });
        } else {
          res.send('This is not your post')
        }
      });
    } else {
      res.send('This user not registered')
    }
  });
});

app.put('/posts/:id', function (req, res) {
  conn.query('SELECT * FROM users WHERE user_name = ?;', req.headers.username, (err, rows) => {
    if (err) {
      res.status(500).send('Get is that user alredy registered error');
      return;
    } else if (rows.length !== 0) {
      let { title, url } = JSON.parse(req.body);
      let whereQueries = [];
      let whereParams = [];
      let user = req.headers.username
      conn.query('SELECT owner_name FROM posts WHERE id = ?', [req.params.id], function (err, rows) {
        if (err) {
          res.status(500).send('Search is there a vote error');
          return;
        } else if (user === rows[0].owner_name) {
          if (title !== undefined) {
            whereQueries.push(`title = ?`);
            whereParams.push(title)
          }
          if (url !== undefined) {
            whereQueries.push(`url = ?`);
            whereParams.push(url)
          }
          const whereSQL = `SET ${whereQueries.join(', ')}`
          conn.query(`UPDATE posts ${whereSQL} WHERE id = ${req.params.id}`, whereParams, function (err, rows) {
            if (err) {
              res.status(500).send('Update error');
              return;
            }
            res.type('application/json').status(200).send(rows)
          });
        } else {
          res.send('This is not your post')
        }
      });
    } else {
      res.send('This user not registered')
    }
  });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
