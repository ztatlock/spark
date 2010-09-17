
function SongDB(url) {
  var db;
  db = eval(fetch(url));
  db = map(intify, db);
  db.sort(song_cmp);

  this.db  = db;
  this._db = db;

  this.restore = function() {
    this.db = this._db;
  }

  this.next = function(s) {
    var db = this.db;
    var i = db.indexOf(s);
    return db[(i+1) % db.length];
  }

  this.prev = function(s) {
    var db = this.db;
    var i = db.indexOf(s);
    return db[(i-1) % db.length];
  }

  this.prep_filter = function(f) {
    // prepend queryable fields with param name 's'
    var fields = ['genre', 'artist', 'album', 'title', 'track', 'year'];
    for(var i in fields) {
      var find = new RegExp(fields[i], 'g');
      var repl = 's.' + fields[i];
      f = f.replace(find, repl);
    }

    // prevent songdb modification, assign ==> compare
    f = f.replace(/([^!=])=([^=])/g, '$1==$2'); 
    return f;
  }

  this.apply_filter = function(f) {
    this.restore();
    if(f != '') {
      f = this.prep_filter(f);
      var test = function(s) { return eval(f); };
      this.db = filter(test, this.db);
    }
    MENU.display();
  }

  this.match_upto = function(fld, s1) {
    var test = function(s2) {
      var fields = ['genre', 'artist', 'album', 'title'];
      for(var i in fields) {
        if(fields[i] == fld)
          break;
        if(proj(fields[i])(s1) != proj(fields[i])(s2))
          return false;
      }
      return true;
    };
    return filter(test, this.db); 
  }
}

// cast apropriate fields from string to int
function intify(s) {
  s.year  = parseInt(s.year,  10);
  s.track = parseInt(s.track, 10);
  s.total = parseInt(s.total, 10);
  return s;
}

function song_cmp(s1, s2) {
       if(s1.genre  < s2.genre)  return -1;
  else if(s1.genre  > s2.genre)  return  1;
  else if(s1.artist < s2.artist) return -1;
  else if(s1.artist > s2.artist) return  1;
  else if(s1.year   < s2.year)   return -1;
  else if(s1.year   > s2.year)   return  1;
  else if(s1.album  < s2.album)  return -1;
  else if(s1.album  > s2.album)  return  1;
  else if(s1.track  < s2.track)  return -1;
  else if(s1.track  > s2.track)  return  1;
  else                           return s1 - s2;
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

  this.display_field = function(fld) {
    var list = elem(fld + '-list');
    list.innerHTML = '';

    var opts = this.field_opts(fld);
    for(var i in opts) {
      var a = this.selector(fld, opts[i]);
      var li = create('li');
      li.appendChild(a);
      list.appendChild(li);
    }
  }

  this.select = function(fld, opt) {
    switch(fld) {
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
        play(this.song());
        break;
    }
    this.display();
  }

  this.selector = function(fld, opt) {
    var a = create('a');
    var m = this;
    a.listen('click', function() { m.select(fld, opt); });
    if(opt == proj(fld)(this)) {
      a.setAttribute('style', 'color: green; font-style: italic;');
    }
    a.innerHTML = opt;
    return a;
  }

  this.field_opts = function(fld) {
    var db = DB.match_upto(fld, this);
    var fs = map(proj(fld), db);
    return uniq(fs);
  }

  this.song = function() {
    return DB.match_upto('all', this)[0];
  }
}





PCACHE  = []; // player cache
PMAX    = 4;  // maximum num cache entries
PMAX    = (PMAX >= 2) ? PMAX : 2; // at least 2 to support prefetch

function register_listeners() {
  var f = elem('filter');
  f.listen('focus',  suspend_kbd);
  f.listen('blur',   enable_kbd);
  f.listen('change', function() { DB.apply_filter(this.value); });
}

/* ------------------------ KEY PRESS HANDLERS ------------------------- */

function set_vol(x) {
  var p = elem('player');
  x = (x > 1) ? 1 : x;
  x = (x < 0.01) ? 0.01 : x;
  p.volume = x;
}

function seek(x) {
  var p = elem('player');
  x = (x < p.startTime) ? p.startTime : x;
  x = (x > p.endTime) ? p.endTime : x;
  p.currentTime = x;
}

function kbd(e) {
  var x;
  var p = elem('player');
  switch(e.keyCode) {
    case 32: // space
      p.paused ? p.play() : p.pause();
      break;
    case 38: // up
      set_vol(p.volume * 1.15);
      break;
    case 40: // down
      set_vol(p.volume * 0.85);
      break;
    case 37: // left
      if(e.ctrlKey) {
        seek(p.currentTime - 5);
      } else {
        play(DB.prev(p.song));
      }
      break;
    case 39: // right
      if(e.ctrlKey) {
        seek(p.currentTime + 5);
      } else {
        play(DB.next(p.song));
      }
      break;
  }
}

document.onkeydown = kbd;

function suspend_kbd() {
  document.onkeydown = false;
}

function enable_kbd() {
  document.onkeydown = kbd;
}

/* --------------------------- SONG PLAYERS  --------------------------- */

function play(song) {
  var v;

  var p_old = elem('player');
  try {
    p_old.pause();
    v = p_old.volume;
    p_old.currentTime = 0;
  } catch(e) { /* whatever */ }

  var p_new = fetch_player(song);
  try {
    p_new.play();
    p_new.volume = v;
    p_new.currentTime = 0;
  } catch(e) { /* whatever */ }

  var p_div = elem('player-div');
  p_div.removeChild(p_old);
  p_div.appendChild(p_new);

  var info =
    song.artist + ' &nbsp; - &nbsp; ' +
    song.album  + ' &nbsp; - &nbsp; ' +
    song.title;
  if(info.length > 110) {
    info = song.artist + ' &nbsp; - &nbsp; ' + song.title;
  }
  elem('playing').innerHTML = info;

  var art = elem('art');
  if(song.art && song.art != '') {
    art.style.visibility = 'visible';
    art.src = song.art;
  } else {
    art.style.visibility = 'hidden';
    art.src = '';
  }

  document.title = song.title;
  MENU.title = song.title;
  MENU.display();
}

function fetch_player(song) {
  pull_in(song);
  pull_in(DB.next(song)); // prefetch
  return lkup_player(song);
}

function lkup_player(song) {
  for(var i in PCACHE) {
    if(PCACHE[i].path == song.path) {
      return PCACHE[i].player;
    }
  }
  return false;
}

function pull_in(song) {
  if(!lkup_player(song)) {
    var p = mk_player(song);
    var e = {path: song.path, player: p};
    PCACHE.push(e);
  }

  // while too big, evict oldest entry
  while(PCACHE.length > PMAX) {
    PCACHE.shift();
  }
}

function mk_player(song) {
  var p = new Audio();
  p.song = song;
  p.id = 'player';
  p.preload = 'auto';
  p.autobuffer = true;
  p.controls = true;
  if(song.path.contains('http')) {
    p.src = song.path;
  } else {
    p.src = escape(song.path);
  }
  p.addEventListener('ended',
                     function() { play(DB.next(p.song)); },
                     false);
  return p;
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

String.prototype.contains = function(s) {
  return this.indexOf(s) != -1;
}

function fetch(url) {
  var req = new XMLHttpRequest();
  req.open('GET', url, false);
  req.send('');
  return req.responseText;
}

function proj(field) {
  return function(s) {
    switch(field) {
      case 'genre'  : return s.genre;
      case 'artist' : return s.artist;
      case 'album'  : return s.album;
      case 'title'  : return s.title;
      case 'art'    : return s.art;
    }
  }
}

function map(f, arr) {
  var res = [];
  for(var i in arr) {
    var e = arr[i];
    res.push(f(e));
  }
  return res;
}

function filter(test, arr) {
  var res = [];
  for(var i in arr) {
    var e = arr[i];
    if(test(e)) {
      res.push(e);
    }
  }
  return res;
}

function uniq(arr) {
  var res = [];
  for(var i in arr) {
    var e = arr[i];
    if(res.indexOf(e) == -1) {
      res.push(e);
    }
  }
  return res;
}

