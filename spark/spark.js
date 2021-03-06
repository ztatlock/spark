FIELDS = ['genre', 'artist', 'album', 'title', 'track'];

SONGDB = null;
MENU   = null;
PLAYER = null;

function main() {
  SONGDB = new SongDB();
  MENU   = new Menu();
  PLAYER = new Player();

  MENU.display();

  // register event handlers
  var f = elem('filter');
  f.listen('focus',  suspend_kbd);
  f.listen('blur',   enable_kbd);
  f.listen('change', filter_change);
  enable_kbd();
}

function kbd(e) {
  var matched = true;

  switch(e.keyCode) {
    case 32: // space
      PLAYER.toggle();
      break;
    case 38: // up
      PLAYER.prev();
      break;
    case 40: // down
      PLAYER.next();
      break;
    case 37: // left
      PLAYER.dec_time();
      break;
    case 39: // right
      PLAYER.inc_time();
      break;
    default:
      matched = false;
      break;
  }

  // do not propagate events handled above
  if(matched) {
    kill_event(e);
  }
}

function suspend_kbd() {
  document.onkeydown = null;
}

function enable_kbd() {
  document.onkeydown = kbd;
}

function filter_change() {
  var q = elem('filter').value;
  SONGDB.apply_filter(q);
  MENU.display();
}

function proj(field) {
  return function(s) {
    switch(field) {
      case 'genre'  : return s.genre;
      case 'artist' : return s.artist;
      case 'album'  : return s.album;
      case 'title'  : return s.title;
      case 'track'  : return s.track;
    }
  }
}

function match_upto(field) {
  return function(s1) {
    return function(s2) {
      for(var i in FIELDS) {
        if(FIELDS[i] == field)
          break;
        if(proj(FIELDS[i])(s1) != proj(FIELDS[i])(s2))
          return false;
      }
      return true;
    }
  }
}

function SongDB() {
  var db;
  db = eval(fetch('songdb'));
  db = map(song_intify, db);
  db.sort(song_cmp);

  this.db  = db;
  this._db = db;

  this.restore = function() {
    this.db = this._db;
  }

  this.get = function(i) {
    return this.db[i % this.db.length];
  }

  this.next = function(s) {
    var i = this.db.indexOf(s);
    return this.get(i + 1);
  }

  this.prev = function(s) {
    var i = this.db.indexOf(s);
    return this.get(i - 1);
  }

  this.apply_filter = function(q) {
    this.restore();
    q = q.trim();
    if(q != '') {
      // expand vars relating to current song
      for(var i in FIELDS) {
        var f = FIELDS[i];
        var r = new RegExp('%' + f, 'g');
        var c = '"' + proj(f)(PLAYER.song) + '"';
        q = q.replace(r, c);
      }

      // prepend fields with param 's'
      for(var i in FIELDS) {
        var f = FIELDS[i];
        var r = new RegExp(f, 'g');
        q = q.replace(r, 's.' + f);
      }

      // prevent db mod, assign ==> compare
      q = q.replace(/([^!<>=])=([^=])/g, '$1==$2'); 

      var test = function(s) { return eval(q); };
      this.db = filter(test, this.db);
    }
  }

  this.match_upto = function(field, s1) {
    var test = match_upto(field)(s1);
    return filter(test, this.db);
  }
}

// cast apropriate fields from string to int
function song_intify(s) {
  s.track = parseInt(s.track, 10);
  s.total = parseInt(s.total, 10);
  return s;
}

function song_cmp(s1, s2) {
       if(s1.genre  < s2.genre)  return -1;
  else if(s1.genre  > s2.genre)  return  1;
  else if(s1.artist < s2.artist) return -1;
  else if(s1.artist > s2.artist) return  1;
  else if(s1.album  < s2.album)  return -1;
  else if(s1.album  > s2.album)  return  1;
  else if(s1.track  < s2.track)  return -1;
  else if(s1.track  > s2.track)  return  1;
  else /* arbitrary less than */ return -1;
}

function Menu() {
  this.genre  = '';
  this.artist = '';
  this.album  = '';
  this.title  = '';

  this.display = function() {
    this.display_field('genre');
    this.display_field('artist');
    this.display_field('album');
    this.display_field('title');
  }

  this.display_field = function(f) {
    var list = elem(f + '-list');
    list.innerHTML = '';

    var opts = this.field_opts(f);
    for(var i in opts) {
      var a = this.selector(f, opts[i]);
      var li = create('li');
      li.appendChild(a);
      list.appendChild(li);
    }
  }

  this.selector = function(field, opt) {
    var a = create('a');
    var s = function () { MENU.select(field, opt); };
    a.listen('click', s);
    a.innerHTML = opt;
    if(opt == proj(field)(this))
      a.className = 'selected';
    return a;
  }

  this.match_upto = function(field) {
    return SONGDB.match_upto(field, this);
  }

  this.song = function() {
    return this.match_upto('track')[0];
  }

  this.field_opts = function(field) {
    var ms = this.match_upto(field);
    var fs = map(proj(field), ms);
    return uniq(fs);
  }

  this.select = function(field, opt) {
    switch(field) {
      case 'genre':
        this.genre  = opt;
        this.artist = '';
        this.album  = '';
        this.title  = '';
        break;
      case 'artist':
        this.artist = opt;
        this.album  = '';
        this.title  = '';
        break;
      case 'album':
        this.album  = opt;
        this.title  = '';
        break;
      case 'title':
        this.title  = opt;
        PLAYER.play(this.song());
        break;
    }
    this.display();
  }
}

function Player() {
  this.acache = [];
  this.ncache = 4;
  this.song   = null;
  this.audio  = null;

  this.play = function(song) {
    if(this.audio != null)
      this.audio.pause();

    this.song = song;
    this.audio = this.fetch_audio(song);
    this.audio.play();

    var pd = elem('player-div');
    pd.innerHTML = '';
    pd.appendChild(this.audio);

    // update display
    var p = song.artist + ' &nbsp; - &nbsp; ' +
            song.album  + ' &nbsp; - &nbsp; ' +
            song.title;
    // try to prevent wrapping
    if(p.length > 110)
      p = song.artist + ' &nbsp; - &nbsp; ' + song.title;
    elem('playing').innerHTML = p;
    document.title = song.title;
    MENU.title = song.title;
    MENU.display();
  }

  this.get_time = function() {
    return this.audio.currentTime;
  }

  this.set_time = function(t) {
    t = (t < this.audio.startTime) ? this.audio.startTime : t;
    t = (t > this.audio.endTime)   ? this.audio.endTime   : t;
    this.audio.currentTime = t;
  }

  this.inc_time = function() {
    var t = this.get_time();
    this.set_time(t + 5);
  }

  this.dec_time = function() {
    var t = this.get_time();
    this.set_time(t - 5);
  }

  this.toggle = function() {
    if(this.audio.paused)
      this.audio.play();
    else
      this.audio.pause();
  }

  this.prev = function() {
    var s = SONGDB.prev(this.song);
    this.play(s);
  }

  this.next = function() {
    var s = SONGDB.next(this.song);
    this.play(s);
  }

  this.fetch_audio = function(song) {
    this.pull_in(song);
    this.pull_in(SONGDB.next(song)); // prefetch
    return this.lkup_audio(song);
  }

  this.lkup_audio = function(song) {
    for(var i in this.acache)
      if(this.acache[i].path == song.path)
        return this.acache[i].audio;
    return false;
  }

  this.pull_in = function(song) {
    if(!this.lkup_audio(song)) {
      var a = this.mk_audio(song);
      var e = {path: song.path, audio: a};
      this.acache.push(e);
    }

    // while too big, evict oldest entry
    while(this.acache.length > this.ncache)
      this.acache.shift();
  }

  this.mk_audio = function(song) {
    var a = new Audio();
    a.id = 'player';
    a.preload = 'auto';
    a.autobuffer = true;
    a.controls = true;
    a.src = escape(song.path);
    a.listen('ended', function() { PLAYER.next(); });
    return a;
  }
}

/* ------------------------- PROGRAMMING SUPPORT ----------------------- */

function elem(id) {
  return document.getElementById(id);
}

function create(tag) {
  return document.createElement(tag);
}

HTMLElement.prototype.listen = function(e, f) {
  this.addEventListener(e, f, false);
}

String.prototype.trim = function() {
  return String(this).replace(/^\s+|\s+$/g, '');
}

/* for user filters */
String.prototype.has = function(s) {
  return this.indexOf(s) != -1;
}

function fetch(url) {
  var req = new XMLHttpRequest();
  req.open('GET', url, false);
  req.send('');
  return req.responseText;
}

function kill_event(e) {
  e.cancelBubble = true;
  e.returnValue  = false;
  if(e.stopPropagation) {
    e.stopPropagation();
    e.preventDefault();
  }
}

function map(f, arr) {
  var res = [];
  for(var i in arr)
    res.push(f(arr[i]));
  return res;
}

function filter(test, arr) {
  var res = [];
  for(var i in arr)
    if(test(arr[i]))
      res.push(arr[i]);
  return res;
}

function uniq(arr) {
  var res = [];
  for(var i in arr)
    if(res.indexOf(arr[i]) == -1)
      res.push(arr[i]);
  return res;
}

