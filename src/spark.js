FIELDS = ['genre', 'artist', 'album', 'title', 'track', 'year'];

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

  this.index = function(s) {
    return this.db.indexOf(s);
  }

  this.size = function() {
    return this.db.length;
  }

  this.get = function(i) {
    return this.db[i % this.size()];
  }

  this.next = function(s) {
    var i = this.index(s);
    return this.get(i + 1);
  }

  this.prev = function(s) {
    var i = this.index(s);
    return this.get(i - 1);
  }

  this.prep_filter = function(q) {
    // prepend fields with param name 's'
    var aux = function(acc, f) {
      return acc.replace(new RegExp(f, 'g'), 's.' + f);
    };
    q = fold(aux, FIELDS, q);

    // prevent db mod, assign ==> compare
    q = q.replace(/([^!=])=([^=])/g, '$1==$2'); 
    return q;
  }

  this.apply_filter = function(q) {
    this.restore();
    if(q != '') {
      q = this.prep_filter(q);
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

function Menu(db) {
  this.genre  = '';
  this.artist = '';
  this.album  = '';
  this.title  = '';
  this.db     = db;

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
        play(this.song());
        break;
    }
    this.display();
  }

  this.selector = function(field, opt) {
    var a = create('a');
    var m = this;
    a.listen('click', function() { m.select(field, opt); });
    if(opt == proj(field)(this)) {
      a.setAttribute('style', 'color: green; font-style: italic;');
    }
    a.innerHTML = opt;
    return a;
  }

  this.match_upto = function(field) {
    return this.db.match_upto(field, this);
  }

  this.field_opts = function(field) {
    var ms = this.match_upto(field);
    var fs = map(proj(field), ms);
    return uniq(fs);
  }

  this.song = function() {
    return this.match_upto('track')[0];
  }
}





PCACHE  = []; // player cache
PMAX    = 4;  // maximum num cache entries
PMAX    = (PMAX >= 2) ? PMAX : 2; // at least 2 to support prefetch

function register_listeners() {
  var f = elem('filter');
  f.listen('focus',  suspend_kbd);
  f.listen('blur',   enable_kbd);
  f.listen('change', function() { DB.apply_filter(this.value); MENU.display(); });
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
      kill_event(e); // do not scroll
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
  document.onkeydown = null;
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

  var info = song.artist + ' &nbsp; - &nbsp; ' +
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

function kill_event(e) {
  e.cancelBubble = true;
  e.returnValue  = false;
  if(e.stopPropagation) {
    e.stopPropagation();
    e.preventDefault();
  }
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

function fold(f, arr, acc) {
  for(var i in arr)
    acc = f(acc, arr[i]);
  return acc;
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

