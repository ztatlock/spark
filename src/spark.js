FIELDS = ['genre', 'artist', 'album', 'title', 'track', 'year'];

function proj(field) {
  return function(s) {
    switch(field) {
      case 'genre'  : return s.genre;
      case 'artist' : return s.artist;
      case 'album'  : return s.album;
      case 'title'  : return s.title;
      case 'track'  : return s.track;
      case 'year'   : return s.year;
      case 'art'    : return s.art;
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

function Menu() {
  this.genre  = '';
  this.artist = '';
  this.album  = '';
  this.title  = '';
  this.db     = null;
  this.player = null;

  this.init = function(db, player) {
    this.db = db;
    this.player = player;
  }

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
        this.player.play(this.song());
        break;
    }
    this.display();
  }

  this.selector = function(field, opt) {
    var a = create('a');
    a.listen('click', mkselector(this, field, opt));
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

// TODO learn why this scoping works
function mkselector(menu, field, opt) {
  return function() {
    menu.select(field, opt);
  }
}

function Player() {
  this.acache = [];
  this.ncache = 4;
  this.song   = null;
  this.audio  = null;
  this.db     = null;
  this.menu   = null;

  this.init = function(db, menu) {
    this.db = db;
    this.menu = menu;
  }

  this.play = function(song) {
    this.song = song;

    var v = 0.8;
    try {
      this.audio.pause();
      v = this.audio.volume;
      this.audio.currentTime = 0.0;
    } catch(e) { /* ignore */ }

    this.audio = this.fetch_audio(song);
    this.audio.play();
    this.audio.volume = v;

    var pd = elem('player-div');
    pd.innerHTML = '';
    pd.appendChild(this.audio);

    this.display();
  }

  this.display = function() {
    var song = this.song;
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
    this.menu.title = song.title;
    this.menu.display();
  }

  this.filter_change = function(q) {
    q = q.trim();
    this.db.apply_filter(q);
    this.menu.display(); 
  }

  this.get_vol = function() {
    return this.audio.volume;
  }

  this.set_vol = function(v) {
    v = (v > 1) ? 1 : v;
    v = (v < 0.01) ? 0.01 : v;
    this.audio.volume = v;
  }

  this.inc_vol = function() {
    var v = this.get_vol();
    this.set_vol(v * 1.15);
  }

  this.dec_vol = function() {
    var v = this.get_vol();
    this.set_vol(v * 0.85);
  }

  this.get_time = function() {
    return this.audio.currentTime;
  }

  this.set_time = function(t) {
    t = (t < p.startTime) ? p.startTime : t;
    t = (t > p.endTime) ? p.endTime : t;
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
    var s = this.db.prev(this.song);
    this.play(s);
  }

  this.next = function() {
    var s = this.db.next(this.song);
    this.play(s);
  }

  this.fetch_audio = function(song) {
    this.pull_in(song);
    this.pull_in(this.db.next(song)); // prefetch
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
    a.song = song;
    a.id = 'player';
    a.preload = 'auto';
    a.autobuffer = true;
    a.controls = true;
    if(song.path.contains('http')) {
      a.src = song.path;
    } else {
      a.src = escape(song.path);
    }
    var p = this;
    a.listen('ended', function() { p.next(); });
    return a;
  }
}

function kbd(player) {
  return function(e) {
    switch(e.keyCode) {
      case 32: // space
        player.toggle();
        break;
      case 38: // up
        player.inc_vol();
        break;
      case 40: // down
        player.dec_vol();
        break;
      case 37: // left
        if(e.ctrlKey) {
          player.dec_time();
        } else {
          player.prev();
        }
        break;
      case 39: // right
        if(e.ctrlKey) {
          player.inc_time();
        } else {
          player.next();
        }
        break;
    }
    // do not propagate
    switch(e.keyCode) {
      case 32: // space
      case 38: // up
      case 40: // down
      case 37: // left
      case 39: // right
        kill_event(e);
    }
  }
}

// TODO understand javascript closure scoping
// very tricky on these keyboard events

function suspend_kbd() {
  document.onkeydown = null;
}

function enable_kbd(player) {
  return function() {
    document.onkeydown = kbd(player);
  }
}

function filter_change(player) {
  return function() {
    var f = elem('filter');
    player.filter_change(f.value);
  }
}

function register(player) {
  var f = elem('filter');
  f.listen('focus',  suspend_kbd);
  f.listen('blur',   enable_kbd(player));
  f.listen('change', filter_change(player));

  enable_kbd(player)();
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

String.prototype.trim = function() {
  return String(this).replace(/^\s+|\s+$/g, '');
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

