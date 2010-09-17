state = { genre  : ''
        , artist : ''
        , album  : ''
        , title  : ''
        , art    : ''
        , volume : 0.8
        };

DB      = []; // song database
ORIG_DB = []; // unblemished copy of DB, for filter
PCACHE  = []; // player cache
PMAX    = 4;  // maximum num cache entries
PMAX    = (PMAX >= 2) ? PMAX : 2; // at least 2 to support prefetch

function register_listeners() {
  var f = elem('filter');
  f.listen('focus',  suspend_kbd);
  f.listen('blur',   enable_kbd);
  f.listen('change', update_filter);
}

/* ------------------------- DISPLAY HANDLERS -------------------------- */

function show() {
  show_field('genre');
  show_field('artist');
  show_field('album');
  show_field('title');
}

function show_field(f) {
  var fs;
  fs = query(f);
  fs = map(selector(f), fs);
  fs = list(fs);
  elem(f + '-list').innerHTML = fs;
}

function select(field, v) {
  switch(field) {
    case 'genre':
      state.genre  = v;
      state.artist = '';
      state.album  = '';
      state.title  = '';
      break;
    case 'artist':
      state.artist = v;
      state.album  = '';
      state.title  = '';
      break;
    case 'album':
      state.album  = v;
      state.title  = '';
      break;
    case 'title':
      state.title  = v;
      play(state_song());
      break;
  }
  show();
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
        play(prev_song(p.song));
      }
      break;
    case 39: // right
      if(e.ctrlKey) {
        seek(p.currentTime + 5);
      } else {
        play(next_song(p.song));
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
  var p_old = elem('player');
  try {
    p_old.pause();
    state.volume = p_old.volume;
    p_old.currentTime = 0;
  } catch(e) { /* whatever */ }

  var p_new = fetch_player(song);
  try {
    p_new.play();
    p_new.volume = state.volume;
    p_new.currentTime = 0;
  } catch(e) { /* whatever */ }

  var p_div = elem('player-div');
  p_div.removeChild(p_old);
  p_div.appendChild(p_new);

  elem('playing').innerHTML = 
    song.artist + ' &nbsp; - &nbsp; ' +
    song.album  + ' &nbsp; - &nbsp; ' +
    song.title;

  var art = elem('art');
  if(song.art && song.art != '') {
    art.style.visibility = 'visible';
    art.src = song.art;
  } else {
    art.style.visibility = 'hidden';
    art.src = '';
  }

  document.title = song.title;
  state.title = song.title;
  show();
}

function fetch_player(song) {
  pull_in(song);
  pull_in(next_song(song)); // prefetch
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
                     function() { play(next_song(p.song)); },
                     false);
  return p;
}

/* ---------------------------- DB QUERIES  ---------------------------- */

function update_filter() {
  DB = ORIG_DB; // restore
  var f = elem('filter').value;
  if(f != '') {
    // prepend queryable fields with param name 's'
    var fields = ['genre', 'artist', 'album', 'title', 'track', 'year'];
    for(var i in fields) {
      var find = new RegExp(fields[i], 'g');
      var repl = 's.' + fields[i];
      f = f.replace(find, repl);
    }
    // prevent songdb modification, assign ==> compare
    f = f.replace(/([^!=])=([^=])/g, '$1==$2'); 
    // only keep DB entries satisfying user filter
    DB = filter(function(s) { return eval(f); }, DB);
  }
  show();
}

function query(field) {
  var test = match_upto(field)(state);
  var db = filter(test, DB);
  var fs = map(proj(field), db);
  return uniq(fs);
}

function match_upto(field) {
  return function(s1) {
    return function(s2) {
      var fields = ['genre', 'artist', 'album', 'title'];
      for(var i in fields) {
        if(fields[i] == field)
          break;
        if(proj(fields[i])(s1) != proj(fields[i])(s2))
          return false;
      }
      return true;
    }
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

function state_song() {
  var test = match_upto('')(state);
  var db = filter(test, DB);
  return db[0];
}

function prev_song(s) {
  var i = DB.indexOf(s);
  return DB[(i-1) % DB.length];
}

function next_song(s) {
  var i = DB.indexOf(s);
  return DB[(i+1) % DB.length];
}

/* ----------------------------- MUSIC DB ------------------------------ */

function fetch_DB() {
  var req = new XMLHttpRequest();
  req.open('GET', '.songdb', false);
  req.send('');
  DB = eval(req.responseText);
  DB = map(intify, DB);
  DB.sort(song_cmp);

  // save a clean copy so filter can restore
  ORIG_DB = DB;
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

/* ------------------------- HTML MANIPULATION ------------------------- */

function elem(id) {
  return document.getElementById(id);
}

HTMLElement.prototype.listen = function(e, f) {
  this.addEventListener(e, f, false);
}

function list(l) {
  function f(e) {
    return '<li>' + e + '</li>'
  }
  var list;
  list = map(f, l);
  list = concat('\n', list);
  return list;
}

function selector(field) {
  return function(v) {
    var style = '';
    if(v == proj(field)(state)) {
      style = 'style=\'color: green; font-style: italic;\' ';
    }
    v = v.replace(/&/g, "&amp;");
    v = v.replace(/'/g, "&#39;");

    // no sprintf, not worth importing lib
    var a;
    a = '<a %s onclick=\'select("%s", "%s");\'>%s</a>';
    a = a.replace('%s', style);
    a = a.replace('%s', field);
    a = a.replace('%s', v);
    a = a.replace('%s', v);
    return a;
  }
}

/* ------------------------- PROGRAMMING SUPPORT ----------------------- */

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

function concat(sep, arr) {
  var res = '';
  for(var i in arr) {
    if(i > 0) {
      res += sep;
    }
    res += arr[i];
  }
  return res;
}

String.prototype.contains =
  function(s) {
    return this.indexOf(s) != -1;
  }

