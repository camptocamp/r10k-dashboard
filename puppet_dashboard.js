/* Main */

var dashboard = new Object();
var cookies = new Object();
var sortTimeout;
var repositories;
var gh_user;
var github;
var token;
var account;
var refresh;
var refresh_randomize;
var repoHeads;
var plugin_options;

(function() {

  updateCell = function(repo, cell, value, state, customkey) {
    var repoLine = document.getElementById(repo);
    var cell = repoLine.getElementsByClassName('plugin:'+cell)[0];
    cell.innerHTML = value;
    if (state) {
      var classes = cell.className.replace(/unknown|err|warn|ok/, '');
      cell.className = classes+' '+state;
    }
    if (customkey) {
      cell.setAttribute('sorttable_customkey', customkey);
    }
    computeState(repoLine, state);
    refreshSortTimeout();
  }

  function computeState(line, newState, force) {
    var oldState = 'unknown';
    var classes = line.className.split(' ');
    var state;
    var cells = line.getElementsByTagName('td');
    var refreshCell = cells[cells.length-1];
    var stateWeight = parseInt(refreshCell.getAttribute('sorttable_customkey')) || 0;
    if (classes.length > 0) {
      for (var i=0; i<classes.length; i++) {
        if (classes[i].match(/unknown|err|warn|ok/)) {
          oldState = classes[i];
          classes.splice(i, 1);
          break;
        }
      }
      if (force) {
        state = newState;
        stateWeight = stateToNum(newState);
      } else {
        state = worstState(oldState, newState);
        stateWeight += stateToNum(newState);
      }
      classes.push(state);
      line.className = classes.join(' ');
    } else {
      state = newState;
      line.className = newState;
    }
    // Use the refresh column to sort by state
    refreshCell.setAttribute('sorttable_customkey', stateWeight);
    refreshCell.getElementsByTagName('i')[0].setAttribute('title', 'score: '+stateWeight);
    refreshTotalScore();
  }

  // TODO: give a numerical weight to each line
  function stateToNum(state) {
    switch (state) {
      case 'err':
        return 1000;
      case 'warn':
        return 100;
      case 'ok':
        return 0;
      default:
        return 10;
    }
  }

  function worstState(oldState, newState) {
    switch (newState) {
      case 'err':
        return 'err';
      case 'warn':
        if (oldState != 'err') return 'warn';
      case 'ok':
        if (oldState != 'err' && oldState != 'warn') return 'ok';
      default:
        return oldState;
    }
  }

  function refreshSort() {
    var reposTable = document.getElementById('repositories');
    var heads = reposTable.getElementsByTagName('th');
    for (var i=0; i<heads.length; i++) {
      if (heads[i].className.match(/\bsorttable_([a-z0-9]+)_reverse\b/)) {
        // first sort by name
        sorttable.innerSortFunction.apply(heads[0], []);
        // sort twice to reverse
        sorttable.innerSortFunction.apply(heads[i], []);
        sorttable.innerSortFunction.apply(heads[i], []);
        break;
      } else if (heads[i].className.match(/\bsorttable_sorted([a-z0-9]*)\b/)) {
        // first sort by name
        sorttable.innerSortFunction.apply(heads[0], []);
        sorttable.innerSortFunction.apply(heads[i], []);
        break;
      }
    }
  }

  // Cookies
  
  function createCookie(name,value,days) {
    if (days) {
      var date = new Date();
      date.setTime(date.getTime()+(days*24*60*60*1000));
      var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
  }

  function readCookie(name) {
    var value = cookies[name];
    if (value) {
      return value;
    } else {
      var nameEQ = name + "=";
      var ca = document.cookie.split(';');
      for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) {
          value = c.substring(nameEQ.length,c.length);
          cookies[name] = value;
          return value;
        }
      }
    }
    return null;
  }

  function eraseCookie(name) {
    createCookie(name,"",-1);
  }
  
  function dispError(err) {
    var reposTable = document.getElementById('repositories');
    var reposTableBody = document.getElementsByTagName('tbody')[0];
    var errElem = document.createElement('tr');
    errElem.setAttribute('id', 'error');
    errElem.innerHTML = '<td colspan="'+(repoHeads.length+2)+'">'+err+'</td>';
    reposTableBody.appendChild(errElem);
  }

  function refreshSortTimeout () {
    clearTimeout(sortTimeout);
    sortTimeout = setTimeout(function() {refreshSort()}, 500);
  }
  
  
  function refreshTotalScore() {
    var totalScore = 0;
    var reposTable = document.getElementById('repositories');
    var reposLines = document.getElementsByTagName('tr');
    // Ignore title line
    for (var i=1; i<reposLines.length; i++) {
      var cells = reposLines[i].getElementsByTagName('td');
      var scoreCell = cells[cells.length-1];
      var score = parseInt(scoreCell.getAttribute('sorttable_customkey')) || 0;
      totalScore += score;
    }
  
    var totalScoreElem = document.getElementById('total_score');
    totalScoreElem.innerHTML = 'Total score: '+totalScore;
  }

  function parsePuppetfile(contents) {
    // Split each entry by newline, unless preceded by a comma
    var entries = atob(contents.content).match(/[^\n][\s\S]+?[^,](?=\s*\n\s*)/g);
    var mods = new Array();
    for (var i=0; i<entries.length; i++) {
      if (/^mod\s/.test(entries[i])) {
        var parts = entries[i].split(/\s*,\s*\n*\s*/);
        var name_parts = parts[0].match(/mod\s+'(\w+)[\/-](\w+)'/)
        var user = name_parts[1];
        var name = name_parts[2];
        var mod = {
          'name': name,
          'user': user
        }
        if (/^'\d+\.\d+\.\d+'$/.test(parts[1])) {
          // Version number
          mod.version = parts[1].replace(/'/g, '');
        } else {
          for (var j=1; j<parts.length; j++) {
            var param_parts = parts[j].split(/\s*=>\s*/);
            mod[param_parts[0].replace(':', '')] = param_parts[1].replace(/'/g, '');
          }
        }
        mods.push(mod);
      }
    }
    return mods;
  }

  function forgeAPICall(path, cb) {
    var url = 'https://forgeapi.puppetlabs.com/v3'+escape(path);
    var xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status >= 200 && this.status < 300 || this.status === 304) {
          cb(null, this.responseText ? JSON.parse(this.responseText) : true, this);
        } else {
          cb({path: path, request: this, error: this.status});
        }
      }
    };
    xhr.setRequestHeader('X-Referer',location.href);
    xhr.setRequestHeader('Content-Type','application/json;charset=UTF-8');
    xhr.send();
  };
    
  function updateRepo(name) {
    forgeAPICall('/modules/'+repositories[name]['info']['user']+'-'+repositories[name]['info']['name'], function(err, res) {
      repositories[name]['forge'] = res;
      updateRepoWithGH(name);
    });
  }

  function updateRepoWithGH(name) {
    repositories[name]['github'] = { }
    if (repositories[name]['info']['git']) {
      repositories[name]['github'].uri = repositories[name]['info']['git'];
    } else if (repositories[name].forge.current_release.metadata.source !== 'UNKNOWN') {
      // Try to get from forge
      repositories[name]['github'].uri = repositories[name].forge.current_release.metadata.source;
    } else {
      // Try with the homepage from forge
      repositories[name]['github'].uri = repositories[name].forge.homepage_url;
    }

    var matches = repositories[name].github.uri.match(/\/([^\/]+)\/([^\/\.]+)(\.git)?$/);
    repositories[name].github.user = matches[1];
    repositories[name].github.repo = matches[2];

    // Update left column
    if (repositories[name].forge) {
      document.getElementById(name).getElementsByTagName('a')[0].href = repositories[name].forge.homepage_url;
    } else {
      document.getElementById(name).getElementsByTagName('a')[0].href = repositories[name].github.uri;
    }

    var r = github.getRepo(repositories[name].github.user, repositories[name].github.repo);
    repositories[name]['repo'] = r;
    var repoLine = document.getElementById(name);
    computeState(repoLine, 'unknown', true);
  
    r.show(function(err, repo) {
      repositories[name].github.repo_obj = r;
      repositories[name].github.repo_obj.info = repo;
      // refresh all cells
      for (i=0; i<repoHeads.length; i++) {
        var plugin = repoHeads[i].replace('plugin:', '');
        dashboard[plugin](name);
      }
    });
  
    // auto-refresh
    if (refresh > 0) {
      refresh_time = refresh + Math.random()*refresh*refresh_randomize;
      setTimeout(function() {updateRepo(name)}, refresh_time);
    }
  }
    
  function listRepos(repos) {
    var spinner = document.getElementById('spinner');
    var reposTable = document.getElementById('repositories');
    var reposTableBody = document.getElementsByTagName('tbody')[0];
  
    spinner.style.display = 'none';
  
    // Filter repos
    var filtered_repos = [];
    for (var i=0; i<repos.length; i++) {
      var name = repos[i].name;
      if (filter) {
        filterReg = new RegExp(filter);
        if (! name.match(filterReg)) continue;
      }
      filtered_repos.push(name);
      repositories[name] = {};
      repositories[name]['info'] = repos[i];
    }
  
    // Update total
    var total = document.getElementById('total');
    if (total) {
      total.innerHTML = repos.length+' modules';
    }

    for (var i=0; i<filtered_repos.length; i++) {
      var name = filtered_repos[i];
      var existing = document.getElementById(name);
      if (! existing) {
        var repoLine = document.createElement('tr');
        repoLine.setAttribute('id', name);
        reposTableBody.appendChild(repoLine);
  
        initRepo(name, repoHeads);
        updateRepo(name);
      }
    }
    filtered_repos.sort();
  
    // Remove obsolete lines
    var listedRepos = reposTableBody.getElementsByTagName('tr');
    for (var i=0; i<listedRepos.length; i++) {
      var name = listedRepos[i].id;
      if (filtered_repos.indexOf(name) < 0) {
        listedRepos[i].style.display = 'none';
        refreshSort();
      }
    }
  
    // auto-refresh
    if (refresh > 0) {
      refresh_time = refresh + Math.random()*refresh*refresh_randomize;
      setTimeout(function() {updateModulesList(account, r10k_repo)}, refresh_time);
    }
  }

  function updateModuleList(account, r10k_repo) {
    var pm_common = github.getRepo(account, r10k_repo);
    pm_common.contents('master', 'Puppetfile', function(err, contents) {
      if(err) {
        dispError('Could not find Puppetfile.');
      } else {
        var modules = parsePuppetfile(contents);
        listRepos(modules);
      }
    });
  }
 
  function initRepo(name, heads) {
    info = repositories[name]['info'];
    html = '<td><a href="#">'+name+'</a></td>';

    for (i=0; i<heads.length; i++) {
      html += '<td class="'+heads[i]+'"><i class="fa fa-spinner fa-spin"></i></td>';
    }
  
    html += '<td><a href="javascript:updateRepo(\''+name+'\')"><i class="fa fa-refresh fa-1g"></i></a></td>';
    document.getElementById(name).innerHTML = html;
  }
  
  function addCookie(name, value, expire) {
    createCookie(name, value, expire);
    cookies[name] = null;
  }

  var PuppetDashboard = function(options) {
    var org = options.org;
    var user = options.user;
    var r10k_repo = options.r10k_repo;
    refresh = options.refresh || 1800000; // 30 minutes
    refresh_randomize = options.refresh_randomize || 0.5; // up to 15 minutes
    var filter = options.filter;
    var autoload = options.autoload;
    var auth_link = options.auth_link || 'auth_link';
    var auth_link_priv = options.auth_link_priv || 'auth_link_priv';
    var auth_remove = options.auth_remove || 'auth_remove';
    plugin_options = options.plugin_options || {};

    account = org || user;

    this.sortByState = function() {
      var reposTable = document.getElementById('repositories');
      var heads = reposTable.getElementsByTagName('th');
      var refreshTH = heads[heads.length-1];
      sorttable.innerSortFunction.apply(refreshTH, []);
      // Twice, to sort by reverse order
      sorttable.innerSortFunction.apply(refreshTH, []);
    }
 
    this.refreshList = function() {
      updateModuleList(account, r10k_repo);
    }
  
    this.authRemove = function() {
      cookie_names = Object.keys(cookies);
      for (var i=0; i<cookie_names.length; i++) {
        eraseCookie(cookie_names[i]);
      }
      window.location.reload();
    }
  
    // Plugins
    this.loadPlugin = function(plugin) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'plugins/'+plugin+'.js';
      document.body.appendChild(script);
    }

    this.load = function(token, scope) {
      if (token) {
        var auth_link_e = document.getElementById(auth_link);
        var auth_link_priv_e = document.getElementById(auth_link_priv);
        var auth_remove_e = document.getElementById(auth_remove);
        if (auth_link_e) {
          auth_link_e.style.display = 'none';
        }
        if (scope == 'repo' && auth_link_priv_e) {
          auth_link_priv_e.style.display = 'none';
        } else {
          auth_link_priv_e.style.display = 'inline-block';
        }
        if (auth_remove_e) {
          auth_remove_e.style.display = 'inline-block';
        }
        github = new Github({
          token: token
        });
      } else {
        // It's ok not to be authenticated
        github = new Github({});
      }
    
      gh_user = github.getUser();
    
      var reposTable = document.getElementById('repositories');
      var reposTableBody = document.getElementsByTagName('tbody')[0];
    
      // Remove all lines in body
      while (reposTableBody.hasChildNodes()) {
        reposTableBody.removeChild(reposTableBody.lastChild);
      }
    
      // Initialize
      repositories = {};
      repoHeads = [];
    
      // Get heads
      var headElems = reposTable.getElementsByTagName('th');
      for (var i=0; i<headElems.length; i++) {
        classes = headElems[i].className.split(' ');
        for (var j=0; j<classes.length; j++) {
          if (classes[j].match(/^plugin:/)) {
            repoHeads.push(classes[j]);
          }
        }
      }
    
      // Load plugins
      for (var i=0; i<repoHeads.length; i++) {
        var plugin = repoHeads[i].replace('plugin:', '');
        this.loadPlugin(plugin);
      }
  
      var spinner = document.createElement('tr');
      spinner.setAttribute('id', 'spinner');
      spinner.innerHTML = '<td colspan="'+(repoHeads.length+2)+'"><img src="images/loading_bar.gif" /></td>';
    
      // TODO: get rid of user/org code
      reposTableBody.appendChild(spinner);
      updateModuleList(account, r10k_repo);
      sorttable.makeSortable(reposTable);
      this.sortByState();
    };

    // Main
    token = readCookie('access_token');
    if (token && autoload) {
      this.load(token);
    }
 
    /* Dashboard functions */
    
    // Called by authentication callback
    var self = this;
    window.authComplete = function(token, scope) {
      addCookie('access_token', token, 1);
      if (autoload) {
        self.load(token, scope);
      }
    }
  };

  if (typeof exports !== 'undefined') {
    // PuppetDashboard = exports;
    module.exports = PuppetDashboard;
    module.exports = updateRepo;
    module.exports = listRepos;
    module.exports = readCookie;
    module.exports = addCookie;
    module.exports = worstState;
  } else {
    window.PuppetDashboard = PuppetDashboard;
    window.updateRepo = updateRepo;
    window.listRepos = listRepos;
    window.readCookie = readCookie;
    window.addCookie = addCookie;
    window.worstState = worstState;
  }
}).call(this);
