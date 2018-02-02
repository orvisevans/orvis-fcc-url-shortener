'use strict';

var fs = require('fs');
var validUrl = require('valid-url');
var express = require('express');
var mongoose = require('mongoose');

var app = express();

const MONGODB_URI = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB;
mongoose.connect(MONGODB_URI);

const URLRedirect = mongoose.model("Url", {longUrl: String, redirectPath: String});
const pathLength = 4;



function generateApiRedirect(redirect) {
  return {original_url: redirect.longUrl, short_url: redirectedUrlWith(redirect.redirectPath)};
}

function redirectedUrlWith(path) {
  return process.env.BASEURL + path;
}
  

function getRedirect(longUrl, callback) {
  console.log("searching for existing redirect");
  if (!validUrl.isUri(longUrl)) { 
    callback({error: "not valid url"}); 
    return console.log(longUrl + " isn't a valid url");
  }
  URLRedirect.findOne({longUrl: longUrl})
    .lean()
    .exec((err, redirect) => {
      if (err) { return console.error("mongodb error: " + err); }
      if (redirect) {
        console.log('found redirect: ' + redirect.toString());
        callback(null, redirect);
      } else {
        newRedirect(longUrl, callback);
      }
  });
}

function generatePath (path = '') {
  let characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let position = Math.floor(Math.random() * characters.length)
  let character = characters.charAt(position)
  if (path.length === pathLength) {
    return path
  }
return generatePath(path + character)
}

function newRedirect(longUrl, callback) {
  console.log("Creating new redirect");
  var newRedirect = new URLRedirect({
    longUrl: longUrl,
    redirectPath: generatePath()
  });
  newRedirect.save((err, URLRedirect) => {
    if (err) { return console.error("mongodb error: " + err); }
    callback(null, URLRedirect);
  });
}

function redirectTo(path, callback) {
  URLRedirect.findOne({redirectPath: path})
    .lean()
    .exec((err, redirect) => {
      if (err) { return console.error("mongodb error: " + err); }
      if (redirect === null) {
        console.log("redirect does not exist: ", path);
        callback({error: "no record"});
        return
      }
      console.log("redirect already exists: ", redirect);
      callback(null, redirect);
  });
  
}




if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });
  
app.route('/')
    .get(function(req, res) {
		  res.sendFile(process.cwd() + '/views/index.html');
    })

// Register a url
app.get('/new/*', (req, res) => {
  var newurl = req.path.slice(5);
  console.log("registering new: " + newurl);
  getRedirect(newurl, (err, redirect) => {
    if (err) { res.send({url: "url error"}); return console.log(err); }
    res.send(generateApiRedirect(redirect));
  });
});

// Return a shortened url
app.use('/:path', (req, res) => {
  console.log("received a path: " + req.params.path);
  redirectTo(req.params.path, (err, redirect) => {
    if (err.error === "no record") { res.send(err); return; }
    if (err) { res.status(500); return console.error(err); }
    console.log("redirecting to " + redirect.longUrl);
    res.redirect(redirect.longUrl);
  });
});

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
});

app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});

